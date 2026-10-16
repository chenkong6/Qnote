import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../utils/time_utils.dart';

class RandomPage extends StatefulWidget {
  final String token;
  const RandomPage({required this.token, super.key});

  @override
  State<RandomPage> createState() => _RandomPageState();
}

class _RandomPageState extends State<RandomPage>
    with SingleTickerProviderStateMixin {
  final _api = ApiClient();
  Map<String, dynamic>? _entry;
  bool _loading = false;
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        duration: const Duration(milliseconds: 500), vsync: this);
    _fadeAnimation = Tween<double>(begin: 0, end: 1)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
    _scaleAnimation = Tween<double>(begin: 0.8, end: 1).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeOutBack));
    _fetch();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    _controller.reset();
    try {
      final e = await _api.getRandomEntry(widget.token);
      setState(() => _entry = e);
      _controller.forward();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('加载失败：$e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('随机回看'),
        elevation: 0,
        backgroundColor: Colors.grey.shade900,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_entry == null || _loading)
                SizedBox(
                  height: 200,
                  child: Center(
                    child: _loading
                        ? const CircularProgressIndicator()
                        : const Text('还没有碎片记录',
                            style: TextStyle(fontSize: 16, color: Colors.grey)),
                  ),
                )
              else
                ScaleTransition(
                  scale: _scaleAnimation,
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.grey.shade900,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey.shade800),
                      ),
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_entry!['content'] ?? '',
                              style: const TextStyle(fontSize: 18, height: 1.6),
                              textAlign: TextAlign.center),
                          const SizedBox(height: 24),
                          Container(
                            width: 60,
                            height: 2,
                            color: Colors.blue.shade400,
                          ),
                          const SizedBox(height: 24),
                          Text(
                              formatLocalTimestamp(_entry!['created_at'],
                                  pattern: 'yyyy-MM-dd HH:mm'),
                              style: TextStyle(
                                  fontSize: 12, color: Colors.grey.shade600)),
                        ],
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 32),
              ScaleTransition(
                scale: Tween<double>(begin: 1, end: 0.95)
                    .animate(AlwaysStoppedAnimation(_loading ? 0.95 : 1)),
                child: ElevatedButton.icon(
                  onPressed: _loading ? null : _fetch,
                  icon: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.refresh),
                  label: const Text('换一条'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue.shade400,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
