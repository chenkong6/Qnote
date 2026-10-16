import 'package:flutter_test/flutter_test.dart';
import 'package:qnote/app_theme.dart';

void main() {
  test('提供默认主题和全部预设配色', () {
    expect(qnoteColorThemes, isNotEmpty);
    expect(qnoteColorThemes.any((theme) => theme.id == 'default'), isTrue);
  });
}
