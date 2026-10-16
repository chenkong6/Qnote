import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../api/api_client.dart';
import '../utils/time_utils.dart';

enum FileDateMode { all, day, month, year }

class CloudDrivePage extends StatefulWidget {
  final String token;
  const CloudDrivePage({required this.token, super.key});

  @override
  State<CloudDrivePage> createState() => _CloudDrivePageState();
}

class _CloudDrivePageState extends State<CloudDrivePage> {
  final _api = ApiClient();
  final _searchCtrl = TextEditingController();
  static const _nativeChannel = MethodChannel('qnote/app_update');
  List<dynamic> _files = [];
  bool _loading = true;
  bool _uploading = false;
  bool _downloading = false;
  FileDateMode _dateMode = FileDateMode.all;
  DateTime? _selectedDate;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final files = await _api.getFiles(widget.token);
      if (mounted) setState(() => _files = files);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('读取云盘失败：$e')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _formatSize(num? size) {
    final value = size?.toDouble() ?? 0;
    if (value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    var current = value;
    var index = 0;
    while (current >= 1024 && index < units.length - 1) {
      current /= 1024;
      index++;
    }
    return '${current.toStringAsFixed(index == 0 ? 0 : 1)} ${units[index]}';
  }

  DateTime? _createdAt(Map<String, dynamic> file) {
    final value = file['created_at']?.toString();
    if (value == null || value.isEmpty) return null;
    return parseUtcTimestamp(value);
  }

  List<Map<String, dynamic>> get _filteredFiles {
    final query = _searchCtrl.text.trim().toLowerCase();
    return _files
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .where((file) {
      if (query.isNotEmpty) {
        final haystack =
            '${file['filename'] ?? ''} ${file['content_type'] ?? ''}'
                .toLowerCase();
        if (!haystack.contains(query)) return false;
      }

      if (_dateMode == FileDateMode.all || _selectedDate == null) return true;

      final createdAt = _createdAt(file);
      if (createdAt == null) return false;

      if (_dateMode == FileDateMode.day) {
        return createdAt.year == _selectedDate!.year &&
            createdAt.month == _selectedDate!.month &&
            createdAt.day == _selectedDate!.day;
      }
      if (_dateMode == FileDateMode.month) {
        return createdAt.year == _selectedDate!.year &&
            createdAt.month == _selectedDate!.month;
      }
      return createdAt.year == _selectedDate!.year;
    }).toList();
  }

  Future<void> _pickAndUpload() async {
    if (_uploading) return;
    final result =
        await _nativeChannel.invokeMethod<Map<dynamic, dynamic>>('pickFile');
    final path = result?['path']?.toString();
    if (path == null) return;

    setState(() => _uploading = true);
    try {
      await _api.uploadFile(widget.token, File(path));
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('文件已上传。')));
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('上传失败：$e')));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _download(Map<String, dynamic> file) async {
    if (_downloading) return;
    final id = file['id'] as int;
    final filename = file['filename']?.toString() ?? 'file';

    setState(() => _downloading = true);
    try {
      final bytes = await _api.downloadFile(widget.token, id);
      final dir = Directory.systemTemp;
      final safeName = filename.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
      final target = File('${dir.path}/$safeName');
      await target.writeAsBytes(bytes, flush: true);
      await _nativeChannel.invokeMethod('openFile', {
        'path': target.path,
        'mimeType':
            file['content_type']?.toString() ?? 'application/octet-stream'
      });
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('下载失败：$e')));
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  Future<void> _delete(Map<String, dynamic> file) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除文件'),
        content: Text('确定删除「${file['filename'] ?? '文件'}」吗？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('取消')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('删除')),
        ],
      ),
    );
    if (ok != true) return;

    try {
      await _api.deleteFile(widget.token, file['id'] as int);
      await _load();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('删除失败：$e')));
    }
  }

  Future<void> _copyPublicLink(Map<String, dynamic> file) async {
    final id = file['id'] as int;
    try {
      if (file['visibility'] != 'public') {
        await _api.setFileVisibility(widget.token, id, 'public');
      }
      await Clipboard.setData(ClipboardData(text: _api.publicFileUrl(id)));
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('公开文件链接已复制。')));
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('分享失败：$e')));
    }
  }

  Future<void> _copyPrivateLink(Map<String, dynamic> file) async {
    try {
      final token = await _api.createPrivateFileShareToken(
          widget.token, file['id'] as int);
      await Clipboard.setData(ClipboardData(text: _api.privateFileUrl(token)));
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('私密文件链接已复制，不会改为公开。')));
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('分享失败：$e')));
    }
  }

  Future<void> _makePrivate(Map<String, dynamic> file) async {
    try {
      await _api.setFileVisibility(widget.token, file['id'] as int, 'private');
      await _load();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('更新失败：$e')));
    }
  }

  Future<void> _pickDate() async {
    if (_dateMode == FileDateMode.all) return;
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? now,
      firstDate: DateTime(1970),
      lastDate: DateTime(2999),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  String _filterLabel() {
    if (_dateMode == FileDateMode.all || _selectedDate == null) return '全部时间';
    if (_dateMode == FileDateMode.day)
      return DateFormat('yyyy-MM-dd').format(_selectedDate!);
    if (_dateMode == FileDateMode.month)
      return DateFormat('yyyy-MM').format(_selectedDate!);
    return DateFormat('yyyy').format(_selectedDate!);
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filtered = _filteredFiles;

    return Scaffold(
      appBar: AppBar(
        title: const Text('云盘'),
        actions: [
          IconButton(
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh)),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _uploading ? null : _pickAndUpload,
        icon: _uploading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.upload_file),
        label: Text(_uploading ? '上传中' : '上传'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _card(
              child: Column(
                children: [
                  TextField(
                    controller: _searchCtrl,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: '搜索文件名或类型',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: SegmentedButton<FileDateMode>(
                          segments: const [
                            ButtonSegment(
                                value: FileDateMode.all, label: Text('全部')),
                            ButtonSegment(
                                value: FileDateMode.day, label: Text('日')),
                            ButtonSegment(
                                value: FileDateMode.month, label: Text('月')),
                            ButtonSegment(
                                value: FileDateMode.year, label: Text('年')),
                          ],
                          selected: {_dateMode},
                          onSelectionChanged: (value) {
                            setState(() {
                              _dateMode = value.first;
                              if (_dateMode == FileDateMode.all)
                                _selectedDate = null;
                            });
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        onPressed:
                            _dateMode == FileDateMode.all ? null : _pickDate,
                        icon: const Icon(Icons.calendar_month),
                        label: Text(_filterLabel()),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text('显示 ${filtered.length} / ${_files.length} 个文件',
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade500)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_files.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 48),
                child: Center(
                    child: Text('还没有上传文件',
                        style: TextStyle(color: Colors.grey.shade500))),
              )
            else if (filtered.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 48),
                child: Center(
                    child: Text('没有符合条件的文件',
                        style: TextStyle(color: Colors.grey.shade500))),
              )
            else
              ...filtered.map((file) {
                final createdAt = _createdAt(file);
                final visibility =
                    file['visibility']?.toString() == 'public' ? '公开' : '私有';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _card(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: theme.colorScheme.primary
                                .withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(Icons.insert_drive_file,
                              color: theme.colorScheme.primary),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(file['filename']?.toString() ?? 'file',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                              const SizedBox(height: 6),
                              Text(
                                '${_formatSize(file['size'] as num?)} · ${file['content_type'] ?? 'application/octet-stream'}',
                                style: TextStyle(
                                    fontSize: 12, color: Colors.grey.shade500),
                              ),
                              if (createdAt != null)
                                Text(
                                  DateFormat('yyyy-MM-dd HH:mm')
                                      .format(createdAt),
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade600),
                                ),
                              const SizedBox(height: 8),
                              Chip(
                                visualDensity: VisualDensity.compact,
                                label: Text(visibility),
                                avatar: Icon(
                                    visibility == '公开'
                                        ? Icons.public
                                        : Icons.lock,
                                    size: 14),
                              ),
                            ],
                          ),
                        ),
                        PopupMenuButton<String>(
                          onSelected: (value) {
                            if (value == 'download') _download(file);
                            if (value == 'public') _copyPublicLink(file);
                            if (value == 'privateShare') _copyPrivateLink(file);
                            if (value == 'makePrivate') _makePrivate(file);
                            if (value == 'delete') _delete(file);
                          },
                          itemBuilder: (context) => [
                            const PopupMenuItem(
                                value: 'download', child: Text('下载并打开')),
                            const PopupMenuItem(
                                value: 'public', child: Text('复制公开链接')),
                            const PopupMenuItem(
                                value: 'privateShare', child: Text('复制私密链接')),
                            if (visibility == '公开')
                              const PopupMenuItem(
                                  value: 'makePrivate', child: Text('设为私有')),
                            const PopupMenuItem(
                                value: 'delete',
                                child: Text('删除',
                                    style: TextStyle(color: Colors.red))),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }),
            if (_downloading)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Center(
                    child: Text('正在下载...',
                        style: TextStyle(color: Colors.grey.shade500))),
              ),
          ],
        ),
      ),
    );
  }
}
