import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../constants.dart';

class ApiClient {
  final String baseUrl;
  ApiClient({String? base}) : baseUrl = base ?? BACKEND_BASE_URL;

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await http.post(Uri.parse('$baseUrl$LOGIN_ENDPOINT'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}));

    if (res.statusCode == 200) {
      return jsonDecode(res.body);
    }
    throw Exception('登录失败：${res.statusCode} ${res.body}');
  }

  Future<List<dynamic>> getEntries(String token) async {
    final res = await http.get(Uri.parse('$baseUrl$ENTRIES_ENDPOINT'),
        headers: {'Authorization': 'Bearer $token'});

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as List<dynamic>;
    }
    throw Exception('获取记录失败：${res.statusCode}');
  }

  Future<void> postEntry(String token, String content) async {
    final res = await http.post(Uri.parse('$baseUrl$ENTRIES_ENDPOINT'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token'
        },
        body: jsonEncode({'content': content}));

    if (res.statusCode != 201 && res.statusCode != 200) {
      throw Exception('保存记录失败：${res.statusCode}');
    }
  }

  Future<void> deleteEntry(String token, int id) async {
    final res = await http.delete(Uri.parse('$baseUrl$ENTRIES_ENDPOINT/$id'),
        headers: {'Authorization': 'Bearer $token'});

    if (res.statusCode != 204 && res.statusCode != 200) {
      throw Exception('删除记录失败：${res.statusCode}');
    }
  }

  Future<void> updateEntry(String token, int id, String content) async {
    final res = await http.patch(Uri.parse('$baseUrl$ENTRIES_ENDPOINT/$id'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token'
        },
        body: jsonEncode({'content': content}));

    if (res.statusCode != 200) {
      throw Exception('更新记录失败：${res.statusCode}');
    }
  }

  Future<void> setEntryVisibility(
      String token, int id, String visibility) async {
    final res = await http.post(
        Uri.parse('$baseUrl$ENTRIES_ENDPOINT/$id/share'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token'
        },
        body: jsonEncode({'visibility': visibility}));

    if (res.statusCode != 200) {
      throw Exception('更新分享状态失败：${res.statusCode}');
    }
  }

  String publicEntryUrl(int id) {
    return '$baseUrl/?share=$id';
  }

  Future<String> createPrivateShareToken(String token, int id) async {
    final res = await http.post(
        Uri.parse('$baseUrl$ENTRIES_ENDPOINT/$id/private-share'),
        headers: {'Authorization': 'Bearer $token'});

    if (res.statusCode == 200) {
      final body = jsonDecode(res.body);
      return body['token'] as String;
    }
    throw Exception('生成私密分享链接失败：${res.statusCode}');
  }

  String privateEntryUrl(String token) {
    return '$baseUrl/?privateShare=$token';
  }

  Future<Map<String, dynamic>> getLatestUpdate() async {
    final res = await http
        .get(Uri.parse('$UPDATE_BASE_URL/api/apps/$UPDATE_APP_ID/latest'))
        .timeout(const Duration(seconds: 10));

    if (res.statusCode == 200) {
      final body = jsonDecode(res.body);
      return body is Map<String, dynamic>
          ? body
          : Map<String, dynamic>.from(body as Map);
    }
    throw Exception('检查更新失败：${res.statusCode}');
  }

  Future<Map<String, dynamic>> getRandomEntry(String token) async {
    final res = await http.get(Uri.parse('$baseUrl$ENTRIES_ENDPOINT/random'),
        headers: {'Authorization': 'Bearer $token'});

    if (res.statusCode == 200) {
      final body = jsonDecode(res.body);
      return body is Map<String, dynamic>
          ? body
          : (body is Map ? Map<String, dynamic>.from(body) : {});
    }
    throw Exception('获取随机记录失败：${res.statusCode}');
  }

  Future<List<dynamic>> getHeatmap(String token) async {
    final res = await http.get(Uri.parse('$baseUrl/api/heatmap'),
        headers: {'Authorization': 'Bearer $token'});

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as List<dynamic>;
    }
    throw Exception('获取热力图失败：${res.statusCode}');
  }

  Future<List<dynamic>> getFiles(String token) async {
    final res = await http.get(Uri.parse('$baseUrl$FILES_ENDPOINT'),
        headers: {'Authorization': 'Bearer $token'});

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as List<dynamic>;
    }
    throw Exception('获取云盘文件失败：${res.statusCode}');
  }

  Future<void> uploadFile(String token, File file) async {
    final request =
        http.MultipartRequest('POST', Uri.parse('$baseUrl$FILES_ENDPOINT'));
    request.headers['Authorization'] = 'Bearer $token';
    request.files.add(await http.MultipartFile.fromPath('file', file.path));

    final response = await request.send();
    if (response.statusCode != 201 && response.statusCode != 200) {
      final body = await response.stream.bytesToString();
      throw Exception('上传失败：${response.statusCode} $body');
    }
  }

  Future<List<int>> downloadFile(String token, int id) async {
    final res = await http.get(Uri.parse('$baseUrl$FILES_ENDPOINT/$id'),
        headers: {'Authorization': 'Bearer $token'});

    if (res.statusCode == 200) {
      return res.bodyBytes;
    }
    throw Exception('下载失败：${res.statusCode}');
  }

  Future<void> deleteFile(String token, int id) async {
    final res = await http.delete(Uri.parse('$baseUrl$FILES_ENDPOINT/$id'),
        headers: {'Authorization': 'Bearer $token'});

    if (res.statusCode != 204 && res.statusCode != 200) {
      throw Exception('删除文件失败：${res.statusCode}');
    }
  }

  Future<void> setFileVisibility(
      String token, int id, String visibility) async {
    final res = await http.post(Uri.parse('$baseUrl$FILES_ENDPOINT/$id/share'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'visibility': visibility}));

    if (res.statusCode != 200) {
      throw Exception('更新文件分享状态失败：${res.statusCode}');
    }
  }

  String publicFileUrl(int id) {
    return '$baseUrl/api/public/files/$id';
  }

  Future<String> createPrivateFileShareToken(String token, int id) async {
    final res = await http.post(
        Uri.parse('$baseUrl$FILES_ENDPOINT/$id/private-share'),
        headers: {'Authorization': 'Bearer $token'});

    if (res.statusCode == 200) {
      final body = jsonDecode(res.body);
      return body['token'] as String;
    }
    throw Exception('生成私密文件链接失败：${res.statusCode}');
  }

  String privateFileUrl(String token) {
    return '$baseUrl/api/private-file-share/${token.replaceFirst('-', '/')}';
  }
}
