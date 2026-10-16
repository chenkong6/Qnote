import 'dart:math';
import 'package:flutter/material.dart';

const qnoteThemeStorageKey = 'qnote-theme';

class QnoteColorTheme {
  final String id;
  final String name;
  final String description;
  final String primaryHex;
  final String secondaryHex;
  final String primaryCmyk;
  final String secondaryCmyk;
  final Color primary;
  final Color secondary;
  final Color background;
  final Color surface;
  final Color border;

  const QnoteColorTheme({
    required this.id,
    required this.name,
    required this.description,
    required this.primaryHex,
    required this.secondaryHex,
    required this.primaryCmyk,
    required this.secondaryCmyk,
    required this.primary,
    required this.secondary,
    required this.background,
    required this.surface,
    required this.border,
  });
}

const qnoteColorThemes = <QnoteColorTheme>[
  QnoteColorTheme(
    id: 'default',
    name: '默认黑白',
    description: '当前经典编辑主题',
    primaryHex: '#0A0A0A',
    secondaryHex: '#FFFFFF',
    primaryCmyk: '默认深黑',
    secondaryCmyk: '默认纯白',
    primary: Color(0xFFFFFFFF),
    secondary: Color(0xFF60A5FA),
    background: Color(0xFF0A0A0A),
    surface: Color(0xFF171717),
    border: Color(0xFF262626),
  ),
  QnoteColorTheme(
    id: 'charcoal-pink',
    name: '炭黑色 + 甜酷粉',
    description: '炭黑色 #1A1A1D / 甜酷粉 #E6397C',
    primaryHex: '#1A1A1D',
    secondaryHex: '#E6397C',
    primaryCmyk: 'C85 M81 Y76 K64',
    secondaryCmyk: 'C12 M88 Y26 K0',
    primary: Color(0xFFE6397C),
    secondary: Color(0xFFFF8AB7),
    background: Color(0xFF1A1A1D),
    surface: Color(0xFF241820),
    border: Color(0xFF3C1A28),
  ),
  QnoteColorTheme(
    id: 'indigo-water',
    name: '捣蓝色 + 清水蓝',
    description: '捣蓝色 #113056 / 清水蓝 #91CFD5',
    primaryHex: '#113056',
    secondaryHex: '#91CFD5',
    primaryCmyk: 'C99 M90 Y51 K20',
    secondaryCmyk: 'C47 M6 Y20 K0',
    primary: Color(0xFF91CFD5),
    secondary: Color(0xFF5FB3BF),
    background: Color(0xFF081B31),
    surface: Color(0xFF113056),
    border: Color(0xFF173850),
  ),
  QnoteColorTheme(
    id: 'warm-red',
    name: '无白色 + 茶花红',
    description: '无白色 #F1DDDF / 茶花红 #E72D48',
    primaryHex: '#F1DDDF',
    secondaryHex: '#E72D48',
    primaryCmyk: 'C7 M17 Y9 K0',
    secondaryCmyk: 'C10 M92 Y63 K0',
    primary: Color(0xFFE72D48),
    secondary: Color(0xFFF1DDDF),
    background: Color(0xFF211317),
    surface: Color(0xFF2D1B20),
    border: Color(0xFF43252B),
  ),
  QnoteColorTheme(
    id: 'vine-violet',
    name: '藤紫色 + 钛啡绿',
    description: '藤紫色 #91C53A / 钛啡绿 #5E55A2',
    primaryHex: '#91C53A',
    secondaryHex: '#5E55A2',
    primaryCmyk: 'C51 M6 Y90 K0',
    secondaryCmyk: 'C74 M73 Y8 K0',
    primary: Color(0xFF91C53A),
    secondary: Color(0xFF5E55A2),
    background: Color(0xFF151426),
    surface: Color(0xFF23213F),
    border: Color(0xFF302C58),
  ),
  QnoteColorTheme(
    id: 'deepsea-milk',
    name: '深海蓝 + 柔奶白',
    description: '深海蓝 #122E8A / 柔奶白 #F5EFEA',
    primaryHex: '#122E8A',
    secondaryHex: '#F5EFEA',
    primaryCmyk: 'C100 M93 Y20 K0',
    secondaryCmyk: 'C5 M7 Y9 K0',
    primary: Color(0xFFF5EFEA),
    secondary: Color(0xFF8DA2FF),
    background: Color(0xFF081746),
    surface: Color(0xFF122E8A),
    border: Color(0xFF1E357B),
  ),
];

QnoteColorTheme qnoteThemeById(String? id) {
  return qnoteColorThemes.firstWhere(
    (theme) => theme.id == id,
    orElse: () => qnoteColorThemes.first,
  );
}

String randomQnoteThemeId() {
  return qnoteColorThemes[Random().nextInt(qnoteColorThemes.length)].id;
}

ThemeData buildQnoteTheme(QnoteColorTheme theme) {
  final scheme = ColorScheme.fromSeed(
    seedColor: theme.primary,
    brightness: Brightness.dark,
    primary: theme.primary,
    secondary: theme.secondary,
    surface: theme.surface,
    onSurface: Colors.white,
  );

  return ThemeData(
    brightness: Brightness.dark,
    useMaterial3: true,
    scaffoldBackgroundColor: theme.background,
    colorScheme: scheme,
    appBarTheme: AppBarTheme(
      backgroundColor: theme.surface,
      foregroundColor: Colors.white,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: theme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: theme.border),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: theme.primary,
        foregroundColor: theme.background,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: theme.primary,
        foregroundColor: theme.background,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: theme.primary,
        side: BorderSide(color: theme.border),
      ),
    ),
  );
}
