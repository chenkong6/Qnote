import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../utils/time_utils.dart';

class HomePage extends StatefulWidget {
  final String token;
  const HomePage({required this.token, super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage>
    with SingleTickerProviderStateMixin {
  final _api = ApiClient();
  List<dynamic> _entries = [];
  final _ctrl = TextEditingController();
  bool _loading = false;
  late AnimationController _submitController;

  @override
  void initState() {
    super.initState();
    _load();
    _submitController = AnimationController(
        duration: const Duration(milliseconds: 300), vsync: this);
  }

  @override
  void dispose() {
    _submitController.dispose();
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await _api.getEntries(widget.token);
      setState(() => _entries = list);
    } catch (e) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('加载失败：$e')));
    }
  }

  Future<void> _post() async {
    if (_ctrl.text.trim().isEmpty) return;
    setState(() => _loading = true);
    _submitController.forward();
    try {
      await _api.postEntry(widget.token, _ctrl.text.trim());
      _ctrl.clear();
      await _load();
    } catch (e) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('保存失败：$e')));
    } finally {
      _submitController.reverse();
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              floating: true,
              pinned: true,
              elevation: 0,
              backgroundColor: Colors.grey.shade900,
              title: const Text('碎片',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const SizedBox(height: 8),
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                          colors: [Colors.blue.shade400, Colors.cyan.shade400]),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('记录此刻',
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: Colors.white70)),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _ctrl,
                          maxLines: 4,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: '写下此刻闪过的念头...',
                            hintStyle: const TextStyle(color: Colors.white30),
                            filled: true,
                            fillColor: Colors.white.withOpacity(0.1),
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide.none),
                            contentPadding: const EdgeInsets.all(12),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            ScaleTransition(
                              scale: Tween<double>(begin: 1, end: 0.95)
                                  .animate(_submitController),
                              child: ElevatedButton.icon(
                                onPressed: _loading ? null : _post,
                                icon: _loading
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2))
                                    : const Icon(Icons.send),
                                label: const Text('保存'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  foregroundColor: Colors.blue.shade400,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text('最近记录',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey)),
                  const SizedBox(height: 12),
                  if (_entries.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: Center(
                          child: Text('还没有碎片记录',
                              style: TextStyle(color: Colors.grey))),
                    )
                  else
                    ..._entries.take(5).map((e) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
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
                              Text(e['content'] ?? '',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 14)),
                              const SizedBox(height: 8),
                              Text(
                                  formatLocalTimestamp(e['created_at'],
                                      pattern: 'yyyy-MM-dd HH:mm'),
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade600)),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
