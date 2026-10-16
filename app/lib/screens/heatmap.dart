import 'package:flutter/material.dart';
import '../api/api_client.dart';

enum HeatmapMode { day, week, month, year }

class HeatmapPage extends StatefulWidget {
  final String token;
  const HeatmapPage({required this.token, super.key});

  @override
  State<HeatmapPage> createState() => _HeatmapPageState();
}

class _HeatmapPageState extends State<HeatmapPage> {
  final _api = ApiClient();
  HeatmapMode _mode = HeatmapMode.day;
  List<dynamic> _data = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _api.getHeatmap(widget.token);
      setState(() => _data = data);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('加载失败：$e')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Color _getColor(double weight) {
    if (weight == 0) return Colors.grey.shade800;
    if (weight < 10) return Colors.green.shade900;
    if (weight < 30) return Colors.green.shade700;
    if (weight < 60) return Colors.green.shade500;
    return Colors.green.shade300;
  }

  String _dateKey(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  double _sumRange(Map<String, double> map, DateTime start, int days) {
    double total = 0;
    for (var i = 0; i < days; i++) {
      total += map[_dateKey(start.add(Duration(days: i)))] ?? 0;
    }
    return total;
  }

  List<_HeatCell> _buildCells(Map<String, double> map) {
    final now = DateTime.now();

    if (_mode == HeatmapMode.day) {
      final days = DateTime(now.year, now.month + 1, 0).day;
      return List.generate(days, (i) {
        final date = DateTime(now.year, now.month, i + 1);
        return _HeatCell(
          label: '${i + 1}',
          title: '${now.year}年${now.month}月${i + 1}日',
          weight: map[_dateKey(date)] ?? 0,
        );
      });
    }

    if (_mode == HeatmapMode.week) {
      return List.generate(26, (i) {
        final end = now.subtract(Duration(days: (25 - i) * 7));
        final start = end.subtract(const Duration(days: 6));
        return _HeatCell(
          label: '${start.month}/${start.day}',
          title: '${start.month}/${start.day} - ${end.month}/${end.day}',
          weight: _sumRange(map, start, 7),
        );
      });
    }

    if (_mode == HeatmapMode.month) {
      return List.generate(12, (i) {
        final month = i + 1;
        final days = DateTime(now.year, month + 1, 0).day;
        return _HeatCell(
          label: '$month月',
          title: '${now.year}年$month月',
          weight: _sumRange(map, DateTime(now.year, month, 1), days),
        );
      });
    }

    final years = <int>{now.year};
    for (final item in _data) {
      if (item is Map && item['date'] is String) {
        final year = int.tryParse((item['date'] as String).substring(0, 4));
        if (year != null) years.add(year);
      }
    }

    final sortedYears = years.toList()..sort((a, b) => b.compareTo(a));
    return sortedYears.map((year) {
      final days =
          year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) ? 366 : 365;
      return _HeatCell(
        label: '$year',
        title: '$year年',
        weight: _sumRange(map, DateTime(year, 1, 1), days),
      );
    }).toList();
  }

  String _modeTitle() {
    final now = DateTime.now();
    switch (_mode) {
      case HeatmapMode.day:
        return '${now.year}年${now.month}月';
      case HeatmapMode.week:
        return '最近 26 周';
      case HeatmapMode.month:
        return '${now.year}年 12 个月';
      case HeatmapMode.year:
        return '按年汇总';
    }
  }

  int _columnsForMode() {
    switch (_mode) {
      case HeatmapMode.day:
        return 7;
      case HeatmapMode.week:
        return 2;
      case HeatmapMode.month:
        return 3;
      case HeatmapMode.year:
        return 1;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));

    final map = <String, double>{};
    for (final item in _data) {
      if (item is Map && item['date'] != null && item['weight'] != null) {
        map[item['date']] = (item['weight'] as num).toDouble();
      }
    }

    final cells = _buildCells(map);
    final totalWeight = _data.fold<double>(
        0, (sum, item) => sum + ((item['weight'] as num?)?.toDouble() ?? 0));
    final activeCount = _data.length;
    final maxWeight = _data.fold<double>(0, (max, item) {
      final weight = (item['weight'] as num?)?.toDouble() ?? 0;
      return weight > max ? weight : max;
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('热力图'),
        elevation: 0,
        backgroundColor: Colors.grey.shade900,
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            SegmentedButton<HeatmapMode>(
              segments: const [
                ButtonSegment(value: HeatmapMode.day, label: Text('日')),
                ButtonSegment(value: HeatmapMode.week, label: Text('周')),
                ButtonSegment(value: HeatmapMode.month, label: Text('月')),
                ButtonSegment(value: HeatmapMode.year, label: Text('年')),
              ],
              selected: {_mode},
              onSelectionChanged: (value) =>
                  setState(() => _mode = value.first),
            ),
            const SizedBox(height: 16),
            Text(_modeTitle(),
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: Colors.grey.shade900,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade800),
              ),
              padding: const EdgeInsets.all(12),
              child: GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: cells.length,
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: _columnsForMode(),
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                  childAspectRatio: _mode == HeatmapMode.day ? 1 : 2.4,
                ),
                itemBuilder: (context, index) {
                  final cell = cells[index];
                  return Tooltip(
                    message: '${cell.title}: ${cell.weight.toStringAsFixed(1)}',
                    child: Container(
                      decoration: BoxDecoration(
                        color: _getColor(cell.weight),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      padding: const EdgeInsets.all(8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(cell.label,
                              style: const TextStyle(fontSize: 11)),
                          if (cell.weight > 0)
                            Text(cell.weight.toStringAsFixed(0),
                                style: const TextStyle(fontSize: 11)),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                _StatCard(value: activeCount.toString(), label: '活跃天数'),
                const SizedBox(width: 12),
                _StatCard(
                    value: (totalWeight / (activeCount > 0 ? activeCount : 1))
                        .toStringAsFixed(1),
                    label: '平均强度'),
                const SizedBox(width: 12),
                _StatCard(value: maxWeight.toStringAsFixed(0), label: '峰值'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HeatCell {
  final String label;
  final String title;
  final double weight;

  _HeatCell({required this.label, required this.title, required this.weight});
}

class _StatCard extends StatelessWidget {
  final String value;
  final String label;

  const _StatCard({required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        decoration: BoxDecoration(
          color: Colors.grey.shade900,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade800),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text(value,
                style:
                    const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(label,
                style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}
