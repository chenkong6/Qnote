import 'package:intl/intl.dart';

DateTime? parseUtcTimestamp(dynamic value) {
  if (value == null) return null;

  final raw = value.toString().trim();
  if (raw.isEmpty) return null;

  final hasTimezone = RegExp(r'(Z|z|[+-]\d{2}:?\d{2})$').hasMatch(raw);
  final normalized = raw.contains('T') ? raw : raw.replaceFirst(' ', 'T');
  final parsed = DateTime.tryParse(hasTimezone ? normalized : '${normalized}Z');

  return parsed?.toLocal();
}

String formatLocalTimestamp(dynamic value,
    {String pattern = 'yyyy年M月d日 HH:mm'}) {
  final date = parseUtcTimestamp(value);
  if (date == null) return '未知时间';

  return DateFormat(pattern).format(date);
}
