import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'app_theme.dart';
import 'screens/login.dart';
import 'screens/home.dart';
import 'screens/timeline.dart';
import 'screens/heatmap.dart';
import 'screens/cloud_drive.dart';
import 'screens/random.dart';
import 'screens/settings.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  String? _token;
  String? _userEmail;
  String _themeId = 'default';
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    await Future.delayed(
        const Duration(milliseconds: 800)); // Splash screen delay
    final prefs = await SharedPreferences.getInstance();
    final t = prefs.getString('token');
    final e = prefs.getString('userEmail');
    var savedTheme = prefs.getString(qnoteThemeStorageKey);
    if (savedTheme == null ||
        !qnoteColorThemes.any((theme) => theme.id == savedTheme)) {
      savedTheme = randomQnoteThemeId();
      await prefs.setString(qnoteThemeStorageKey, savedTheme);
    }
    setState(() {
      _token = t;
      _userEmail = e;
      _themeId = savedTheme!;
      _initialized = true;
    });
  }

  void _onLoggedIn(String token, String email) {
    setState(() {
      _token = token;
      _userEmail = email;
    });
  }

  void _onLogout() {
    setState(() {
      _token = null;
      _userEmail = null;
    });
  }

  Future<void> _onThemeChanged(String themeId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(qnoteThemeStorageKey, themeId);
    setState(() => _themeId = themeId);
  }

  @override
  Widget build(BuildContext context) {
    final colorTheme = qnoteThemeById(_themeId);
    return MaterialApp(
      title: '碎片',
      theme: buildQnoteTheme(colorTheme),
      home: _initialized
          ? (_token == null
              ? LoginPage(
                  onLoggedIn: (token, email) => _onLoggedIn(token, email))
              : MainPage(
                  token: _token!,
                  userEmail: _userEmail ?? '',
                  colorTheme: colorTheme,
                  selectedThemeId: _themeId,
                  onThemeChanged: _onThemeChanged,
                  onLogout: _onLogout,
                ))
          : SplashScreen(colorTheme: colorTheme),
    );
  }
}

class SplashScreen extends StatefulWidget {
  final QnoteColorTheme colorTheme;
  const SplashScreen({required this.colorTheme, super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        duration: const Duration(milliseconds: 800), vsync: this);
    _fadeAnimation = Tween<double>(begin: 0, end: 1).animate(_controller);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: widget.colorTheme.background,
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [
                    widget.colorTheme.primary,
                    widget.colorTheme.secondary
                  ]),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.note_outlined,
                    size: 40, color: Colors.white),
              ),
              const SizedBox(height: 24),
              const Text('碎片',
                  style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white)),
              const SizedBox(height: 8),
              Text('私人时间流',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            ],
          ),
        ),
      ),
    );
  }
}

class MainPage extends StatefulWidget {
  final String token;
  final String userEmail;
  final QnoteColorTheme colorTheme;
  final String selectedThemeId;
  final ValueChanged<String> onThemeChanged;
  final VoidCallback onLogout;
  const MainPage({
    required this.token,
    required this.userEmail,
    required this.colorTheme,
    required this.selectedThemeId,
    required this.onThemeChanged,
    required this.onLogout,
    super.key,
  });

  @override
  State<MainPage> createState() => _MainPageState();
}

class _MainPageState extends State<MainPage> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomePage(token: widget.token),
      TimelinePage(token: widget.token),
      HeatmapPage(token: widget.token),
      CloudDrivePage(token: widget.token),
      RandomPage(token: widget.token),
      SettingsPage(
        userEmail: widget.userEmail,
        selectedThemeId: widget.selectedThemeId,
        onThemeChanged: widget.onThemeChanged,
        onLogout: widget.onLogout,
      ),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: pages,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        type: BottomNavigationBarType.fixed,
        backgroundColor: widget.colorTheme.surface,
        selectedItemColor: widget.colorTheme.primary,
        unselectedItemColor: Colors.grey.shade600,
        onTap: (idx) {
          if (idx != _currentIndex) {
            setState(() => _currentIndex = idx);
          }
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.edit_note), label: '记录'),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: '时间线'),
          BottomNavigationBarItem(
              icon: Icon(Icons.calendar_month), label: '热力图'),
          BottomNavigationBarItem(icon: Icon(Icons.cloud), label: '云盘'),
          BottomNavigationBarItem(icon: Icon(Icons.shuffle), label: '随机'),
          BottomNavigationBarItem(icon: Icon(Icons.settings), label: '设置'),
        ],
      ),
    );
  }
}
