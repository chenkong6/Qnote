import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../app_theme.dart';
import '../api/api_client.dart';
import '../constants.dart';

class SettingsPage extends StatefulWidget {
  final String userEmail;
  final String selectedThemeId;
  final ValueChanged<String> onThemeChanged;
  final VoidCallback onLogout;
  const SettingsPage({
    required this.userEmail,
    required this.selectedThemeId,
    required this.onThemeChanged,
    required this.onLogout,
    super.key,
  });

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _api = ApiClient();
  static const _updateChannel = MethodChannel('qnote/app_update');
  bool _checkingUpdate = false;
  bool _downloading = false;
  double _downloadProgress = 0;
  String _downloadStatus = '';

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('userEmail');
    if (mounted) {
      widget.onLogout();
      Navigator.of(context).pushReplacementNamed('/');
    }
  }

  int _compareVersion(String remote, String local) {
    final remoteParts =
        remote.split('.').map((v) => int.tryParse(v) ?? 0).toList();
    final localParts =
        local.split('.').map((v) => int.tryParse(v) ?? 0).toList();
    final length = remoteParts.length > localParts.length
        ? remoteParts.length
        : localParts.length;

    for (var i = 0; i < length; i++) {
      final r = i < remoteParts.length ? remoteParts[i] : 0;
      final l = i < localParts.length ? localParts[i] : 0;
      if (r != l) return r.compareTo(l);
    }
    return 0;
  }

  bool _hasUpdate(Map<String, dynamic> latest) {
    final remoteBuild = latest['build'];
    if (remoteBuild is num && remoteBuild.toInt() > APP_LOCAL_BUILD)
      return true;

    final remoteVersion = latest['version'];
    if (remoteVersion is String &&
        _compareVersion(remoteVersion, APP_LOCAL_VERSION) > 0) return true;

    return false;
  }

  Future<void> _checkUpdate() async {
    setState(() => _checkingUpdate = true);
    try {
      final latest = await _api.getLatestUpdate();
      final hasUpdate = _hasUpdate(latest);
      if (!mounted) return;
      _showUpdateDialog(latest, hasUpdate);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('检查更新失败：$e')));
      }
    } finally {
      if (mounted) setState(() => _checkingUpdate = false);
    }
  }

  Future<void> _downloadAndInstall(String downloadUrl, String version) async {
    if (_downloading) return;

    Navigator.of(context).pop();
    setState(() {
      _downloading = true;
      _downloadProgress = 0;
      _downloadStatus = '正在连接...';
    });

    final client = http.Client();
    IOSink? sink;

    try {
      final request = http.Request('GET', Uri.parse(downloadUrl));
      final response =
          await client.send(request).timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) {
        throw Exception('下载失败：${response.statusCode}');
      }

      final total = response.contentLength ?? 0;
      var received = 0;
      final file =
          File('${Directory.systemTemp.parent.path}/cache/qnote-$version.apk');
      await file.parent.create(recursive: true);
      sink = file.openWrite();

      await for (final chunk in response.stream) {
        received += chunk.length;
        sink.add(chunk);
        if (total > 0 && mounted) {
          setState(() {
            _downloadProgress = received / total;
            _downloadStatus =
                '正在下载 ${(_downloadProgress * 100).toStringAsFixed(0)}%';
          });
        }
      }

      await sink.flush();
      await sink.close();
      sink = null;

      if (!mounted) return;
      setState(() {
        _downloadProgress = 1;
        _downloadStatus = '下载完成，正在打开安装程序...';
      });

      await _updateChannel.invokeMethod('installApk', {'path': file.path});
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('下载失败：$e')));
      }
    } finally {
      await sink?.close();
      client.close();
      if (mounted) {
        setState(() {
          _downloading = false;
        });
      }
    }
  }

  void _showUpdateDialog(Map<String, dynamic> latest, bool hasUpdate) {
    final version = latest['version']?.toString() ?? '未知版本';
    final build = latest['build']?.toString() ?? '-';
    final releaseDate = latest['releaseDate']?.toString() ?? '';
    final downloadUrl = latest['downloadUrl']?.toString() ??
        latest['sourceUrl']?.toString() ??
        '';
    final changelog = latest['changelog'] is List
        ? List.from(latest['changelog'] as List)
        : const [];

    showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => AlertDialog(
        title: Text(hasUpdate ? '发现新版本' : '已是最新版本'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('当前版本：$APP_LOCAL_VERSION（$APP_LOCAL_BUILD）'),
              const SizedBox(height: 8),
              Text('最新版本：$version（$build）'),
              if (releaseDate.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text('发布日期：$releaseDate'),
              ],
              if (changelog.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('更新内容',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                ...changelog.map((item) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text('- $item'),
                    )),
              ],
              if (downloadUrl.isNotEmpty) ...[
                const SizedBox(height: 16),
                SelectableText(downloadUrl,
                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('稍后'),
          ),
          if (downloadUrl.isNotEmpty)
            TextButton(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: downloadUrl));
                if (ctx.mounted) Navigator.pop(ctx);
                if (mounted) {
                  ScaffoldMessenger.of(context)
                      .showSnackBar(const SnackBar(content: Text('下载链接已复制。')));
                }
              },
              child: const Text('复制链接'),
            ),
          if (hasUpdate && downloadUrl.isNotEmpty)
            FilledButton(
              onPressed: () => _downloadAndInstall(downloadUrl, version),
              child: const Text('直接下载'),
            ),
        ],
      ),
    );
  }

  Widget _card({required Widget child}) {
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
      ),
      padding: const EdgeInsets.all(16),
      child: child,
    );
  }

  Widget _themeSelector() {
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('配色方案',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey)),
          const SizedBox(height: 8),
          const Text('选择会保存在本机，下次打开自动沿用。',
              style: TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 16),
          ...qnoteColorThemes.map((item) {
            final selected = item.id == widget.selectedThemeId;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => widget.onThemeChanged(item.id),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: selected ? item.primary : Colors.grey.shade800),
                  ),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: SizedBox(
                          width: 64,
                          height: 40,
                          child: Row(
                            children: [
                              Expanded(
                                  child: Container(
                                      color: Color(int.parse(item.primaryHex
                                          .replaceFirst('#', '0xFF'))))),
                              Expanded(
                                  child: Container(
                                      color: Color(int.parse(item.secondaryHex
                                          .replaceFirst('#', '0xFF'))))),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                    child: Text(item.name,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w600))),
                                if (selected)
                                  const Text('使用中',
                                      style: TextStyle(
                                          fontSize: 12, color: Colors.grey)),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(item.description,
                                style: const TextStyle(
                                    fontSize: 11, color: Colors.grey)),
                            Text('${item.primaryCmyk} / ${item.secondaryCmyk}',
                                style: const TextStyle(
                                    fontSize: 10, color: Colors.grey)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => widget.onThemeChanged(randomQnoteThemeId()),
              icon: const Icon(Icons.casino),
              label: const Text('随机换色'),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('设置'),
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _card(
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: [
                      Theme.of(context).colorScheme.primary,
                      Theme.of(context).colorScheme.secondary
                    ]),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      widget.userEmail.isNotEmpty
                          ? widget.userEmail[0].toUpperCase()
                          : 'U',
                      style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.white),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('用户账号',
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Colors.grey)),
                      const SizedBox(height: 4),
                      Text(widget.userEmail,
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _themeSelector(),
          const SizedBox(height: 24),
          _card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('版本更新',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey)),
                const SizedBox(height: 8),
                const Text('当前版本 $APP_LOCAL_VERSION (构建号：$APP_LOCAL_BUILD)',
                    style: TextStyle(fontSize: 14)),
                if (_downloading) ...[
                  const SizedBox(height: 16),
                  LinearProgressIndicator(
                      value: _downloadProgress > 0 ? _downloadProgress : null),
                  const SizedBox(height: 8),
                  Text(_downloadStatus,
                      style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed:
                        (_checkingUpdate || _downloading) ? null : _checkUpdate,
                    icon: _checkingUpdate
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.system_update),
                    label: Text(_checkingUpdate ? '正在检查...' : '检查更新'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _card(
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('关于',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey)),
                SizedBox(height: 8),
                Text('碎片 - 私人时间流记录系统', style: TextStyle(fontSize: 14)),
                SizedBox(height: 4),
                Text('版本 0.1.1',
                    style: TextStyle(fontSize: 12, color: Colors.grey)),
                SizedBox(height: 12),
                Text('一个极简记录应用，支持活跃度统计和本地登录状态保存。',
                    style: TextStyle(
                        fontSize: 12, color: Colors.grey, height: 1.5)),
              ],
            ),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _logout,
              icon: const Icon(Icons.logout),
              label: const Text('退出登录'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red.shade900,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
