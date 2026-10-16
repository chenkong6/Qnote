package com.example.fragment_app

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    private val channelName = "qnote/app_update"
    private val pickFileRequestCode = 4105
    private var pendingPickResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName).setMethodCallHandler { call, result ->
            when (call.method) {
                "installApk" -> {
                    val path = call.argument<String>("path")
                    if (path.isNullOrBlank()) {
                        result.error("INVALID_PATH", "APK path is empty", null)
                        return@setMethodCallHandler
                    }

                    try {
                        installApk(path)
                        result.success(true)
                    } catch (error: Exception) {
                        result.error("INSTALL_FAILED", error.message, null)
                    }
                }
                "openUrl" -> {
                    val url = call.argument<String>("url")
                    if (url.isNullOrBlank()) {
                        result.error("INVALID_URL", "URL is empty", null)
                        return@setMethodCallHandler
                    }

                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    result.success(true)
                }
                "pickFile" -> {
                    if (pendingPickResult != null) {
                        result.error("PICK_IN_PROGRESS", "A file picker is already open", null)
                        return@setMethodCallHandler
                    }

                    pendingPickResult = result
                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                    }
                    startActivityForResult(intent, pickFileRequestCode)
                }
                "openFile" -> {
                    val path = call.argument<String>("path")
                    val mimeType = call.argument<String>("mimeType") ?: "*/*"
                    if (path.isNullOrBlank()) {
                        result.error("INVALID_PATH", "File path is empty", null)
                        return@setMethodCallHandler
                    }

                    try {
                        openFile(path, mimeType)
                        result.success(true)
                    } catch (error: Exception) {
                        result.error("OPEN_FAILED", error.message, null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode != pickFileRequestCode) return

        val result = pendingPickResult
        pendingPickResult = null

        if (result == null) return
        val uri = data?.data
        if (resultCode != RESULT_OK || uri == null) {
            result.success(null)
            return
        }

        try {
            val copied = copyUriToCache(uri)
            result.success(copied)
        } catch (error: Exception) {
            result.error("PICK_FAILED", error.message, null)
        }
    }

    private fun installApk(path: String) {
        val apkFile = File(path)
        val apkUri = FileProvider.getUriForFile(
            this,
            "${applicationContext.packageName}.fileprovider",
            apkFile
        )

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(intent)
    }

    private fun openFile(path: String, mimeType: String) {
        val file = File(path)
        val uri = FileProvider.getUriForFile(
            this,
            "${applicationContext.packageName}.fileprovider",
            file
        )

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, mimeType)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(Intent.createChooser(intent, "打开文件"))
    }

    private fun copyUriToCache(uri: Uri): Map<String, Any?> {
        val filename = queryFilename(uri) ?: "upload-file"
        val safeName = filename.replace(Regex("[\\\\/:*?\"<>|]"), "_")
        val target = File(cacheDir, "upload-${System.currentTimeMillis()}-$safeName")

        contentResolver.openInputStream(uri).use { input ->
            if (input == null) throw IllegalStateException("Cannot open selected file")
            target.outputStream().use { output ->
                input.copyTo(output)
            }
        }

        return mapOf(
            "path" to target.absolutePath,
            "name" to filename,
            "size" to target.length()
        )
    }

    private fun queryFilename(uri: Uri): String? {
        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIndex >= 0 && cursor.moveToFirst()) {
                return cursor.getString(nameIndex)
            }
        }
        return uri.lastPathSegment
    }
}
