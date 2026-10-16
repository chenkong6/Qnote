import 'package:flutter/material.dart';
import '../api/api_client.dart';
import 'package:flutter/services.dart';
import '../utils/time_utils.dart';

class TimelinePage extends StatefulWidget {
  final String token;
  const TimelinePage({required this.token, super.key});

  @override
  State<TimelinePage> createState() => _TimelinePageState();
}

class _TimelinePageState extends State<TimelinePage> {
  final _api = ApiClient();
  final _searchCtrl = TextEditingController();
  List<dynamic> _entries = [];
  bool _loading = true;

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

  List<Map<String, dynamic>> get _filteredEntries {
    final query = _searchCtrl.text.trim().toLowerCase();
    final entries = _entries
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList();

    if (query.isEmpty) return entries;

    return entries.where((entry) {
      final date = formatLocalTimestamp(entry['created_at'],
          pattern: 'yyyy年M月d日 HH:mm:ss yyyy-MM-dd HH:mm:ss');
      final visibility =
          entry['visibility'] == 'public' ? '公开 public' : '私密 private';
      final haystack = [
        entry['id'],
        entry['content'] ?? '',
        entry['mood'] ?? '平静',
        entry['weight'] ?? '',
        visibility,
        date,
      ].join(' ').toLowerCase();

      return haystack.contains(query);
    }).toList();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final list = await _api.getEntries(widget.token);
      setState(() => _entries = list);
    } catch (e) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('加载失败：$e')));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _delete(int id) async {
    if (!mounted) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除'),
        content: const Text('确定删除这条碎片吗？'),
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

    if (confirm != true) return;
    try {
      await _api.deleteEntry(widget.token, id);
      await _load();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('删除失败：$e')));
    }
  }

  Future<void> _edit(int id, String current) async {
    if (!mounted) return;
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _EntryEditorPage(
          token: widget.token,
          entryId: id,
          initialContent: current,
        ),
      ),
    );

    if (updated == true) await _load();
  }

  Future<void> _openEntry(Map<String, dynamic> entry) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _EntryDetailPage(entry: entry),
      ),
    );
  }

  Future<void> _share(Map<String, dynamic> entry) async {
    final id = entry['id'] as int;
    try {
      if (entry['visibility'] != 'public') {
        await _api.setEntryVisibility(widget.token, id, 'public');
      }
      await Clipboard.setData(ClipboardData(text: _api.publicEntryUrl(id)));
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('公开链接已复制，可以分享给别人。')));
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('分享失败：$e')));
    }
  }

  Future<void> _privateShare(Map<String, dynamic> entry) async {
    final id = entry['id'] as int;
    try {
      final token = await _api.createPrivateShareToken(widget.token, id);
      await Clipboard.setData(ClipboardData(text: _api.privateEntryUrl(token)));
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('私密分享链接已复制，不会改为公开。')));
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('分享失败：$e')));
    }
  }

  Future<void> _makePrivate(int id) async {
    try {
      await _api.setEntryVisibility(widget.token, id, 'private');
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('已设为私密。')));
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('更新失败：$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final filteredEntries = _filteredEntries;
    final hasSearch = _searchCtrl.text.trim().isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: Text(hasSearch
            ? '时间线 ${filteredEntries.length}/${_entries.length}'
            : '时间线'),
        elevation: 0,
        backgroundColor: Colors.grey.shade900,
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _entries.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 180),
                  Center(child: Text('还没有碎片记录')),
                ],
              )
            : ListView.builder(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                itemCount:
                    filteredEntries.length + (filteredEntries.isEmpty ? 2 : 1),
                itemBuilder: (context, idx) {
                  if (idx == 0) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.grey.shade900,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade800),
                        ),
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            TextField(
                              controller: _searchCtrl,
                              onChanged: (_) => setState(() {}),
                              decoration: InputDecoration(
                                prefixIcon: const Icon(Icons.search),
                                suffixIcon: hasSearch
                                    ? IconButton(
                                        tooltip: '清空搜索',
                                        onPressed: () {
                                          _searchCtrl.clear();
                                          setState(() {});
                                        },
                                        icon: const Icon(Icons.close),
                                      )
                                    : null,
                                hintText: '搜索正文、日期、心情、编号或分享状态',
                                border: const OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    hasSearch
                                        ? '显示 ${filteredEntries.length} / ${_entries.length} 条'
                                        : '已收集 ${_entries.length} 条',
                                    style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.grey.shade500),
                                  ),
                                ),
                                TextButton(
                                  onPressed: hasSearch
                                      ? () {
                                          _searchCtrl.clear();
                                          setState(() {});
                                        }
                                      : null,
                                  child: const Text('回到全部'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  if (filteredEntries.isEmpty) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 72),
                      child: Center(
                          child: Text('没有找到匹配的记录',
                              style: TextStyle(color: Colors.grey.shade500))),
                    );
                  }

                  final e = filteredEntries[idx - 1];
                  final dateStr = formatLocalTimestamp(e['created_at']);
                  final entry = Map<String, dynamic>.from(e);

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.grey.shade900,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade800),
                      ),
                      child: ListTile(
                        onTap: () => _openEntry(entry),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        title: Text(
                          e['content'] ?? '',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 15, height: 1.45),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 8),
                            Text(dateStr,
                                style: TextStyle(
                                    fontSize: 12, color: Colors.grey.shade600)),
                            const SizedBox(height: 6),
                            Text(
                              e['visibility'] == 'public' ? '公开' : '私密',
                              style: TextStyle(
                                fontSize: 12,
                                color: e['visibility'] == 'public'
                                    ? Colors.green.shade300
                                    : Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ),
                        trailing: PopupMenuButton(
                          itemBuilder: (ctx) => [
                            PopupMenuItem(
                              onTap: () => _share(entry),
                              child: Text(e['visibility'] == 'public'
                                  ? '复制公开链接'
                                  : '公开并复制链接'),
                            ),
                            PopupMenuItem(
                              onTap: () => _privateShare(entry),
                              child: const Text('复制私密链接'),
                            ),
                            if (e['visibility'] == 'public')
                              PopupMenuItem(
                                onTap: () => _makePrivate(e['id']),
                                child: const Text('设为私密'),
                              ),
                            PopupMenuItem(
                              onTap: () => _edit(e['id'], e['content'] ?? ''),
                              child: const Text('编辑'),
                            ),
                            PopupMenuItem(
                              onTap: () => _delete(e['id']),
                              child: const Text('删除',
                                  style: TextStyle(color: Colors.red)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class _EntryDetailPage extends StatelessWidget {
  final Map<String, dynamic> entry;

  const _EntryDetailPage({required this.entry});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final createdAt = formatLocalTimestamp(entry['created_at'],
        pattern: 'yyyy年M月d日 HH:mm:ss');

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('完整记录'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(height: 1, color: theme.dividerColor),
        ),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 22, 24, 16),
              child: Row(
                children: [
                  Icon(Icons.schedule_outlined,
                      size: 17, color: theme.colorScheme.onSurfaceVariant),
                  const SizedBox(width: 8),
                  Text(createdAt,
                      style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                  const Spacer(),
                  Text(
                    entry['visibility'] == 'public' ? '公开' : '私密',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: entry['visibility'] == 'public'
                          ? Colors.green.shade300
                          : theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SelectionArea(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
                  child: Text(
                    entry['content'] ?? '',
                    style: theme.textTheme.bodyLarge
                        ?.copyWith(height: 1.8, fontSize: 18),
                  ),
                ),
              ),
            ),
            SafeArea(
              top: false,
              minimum: const EdgeInsets.fromLTRB(24, 12, 24, 20),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.arrow_back),
                  label: const Text('返回时间线'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EntryEditorPage extends StatefulWidget {
  final String token;
  final int entryId;
  final String initialContent;

  const _EntryEditorPage({
    required this.token,
    required this.entryId,
    required this.initialContent,
  });

  @override
  State<_EntryEditorPage> createState() => _EntryEditorPageState();
}

class _EntryEditorPageState extends State<_EntryEditorPage> {
  late final TextEditingController _controller;
  final _api = ApiClient();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialContent);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final content = _controller.text.trim();
    if (content.isEmpty || _saving) return;
    setState(() => _saving = true);
    try {
      await _api.updateEntry(widget.token, widget.entryId, content);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('更新失败：$e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('编辑记录'),
        automaticallyImplyLeading: false,
        actions: [
          TextButton(
            onPressed: _saving ? null : () => Navigator.of(context).pop(),
            child: const Text('取消'),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 12),
              child: Text(
                'fragment #${widget.entryId}',
                style: theme.textTheme.labelMedium
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TextField(
                  controller: _controller,
                  autofocus: true,
                  expands: true,
                  maxLines: null,
                  minLines: null,
                  textAlignVertical: TextAlignVertical.top,
                  keyboardType: TextInputType.multiline,
                  style: theme.textTheme.titleMedium?.copyWith(height: 1.6),
                  decoration: InputDecoration(
                    hintText: '写下此刻闪过的念头…',
                    alignLabelWithHint: true,
                    contentPadding: const EdgeInsets.all(20),
                    filled: true,
                    fillColor: theme.colorScheme.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: theme.dividerColor),
                    ),
                  ),
                ),
              ),
            ),
            SafeArea(
              top: false,
              minimum: const EdgeInsets.fromLTRB(16, 16, 16, 20),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.save_outlined),
                  label: Text(_saving ? '保存中…' : '保存修改'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
