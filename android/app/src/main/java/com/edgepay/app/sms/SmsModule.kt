package com.edgepay.app.sms

import android.Manifest
import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.telephony.SmsManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

class SmsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), PermissionListener {

    private var permissionPromise: Promise? = null

    private data class InboxMessage(
        val sender: String,
        val body: String,
        val timestamp: Long,
        val source: String,
    )

    companion object {
        const val NAME = "SmsModule"
        const val SMS_RECEIVED_EVENT = "onSmsReceived"
        const val SMS_SENT_EVENT = "onSmsSent"
        const val SMS_PERMISSION_REQUEST_CODE = 1001
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun sendSms(phoneNumber: String, message: String, promise: Promise) {
        try {
            if (ContextCompat.checkSelfPermission(
                    reactApplicationContext,
                    Manifest.permission.SEND_SMS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                promise.reject("PERMISSION_DENIED", "SMS permission not granted")
                return
            }

            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                reactApplicationContext.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            val parts = smsManager.divideMessage(message)
            if (parts.size > 1) {
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            } else {
                smsManager.sendTextMessage(phoneNumber, null, message, null, null)
            }

            // Send event success
            sendEvent(SMS_SENT_EVENT, Arguments.createMap().apply {
                putString("status", "SENT")
                putString("phoneNumber", phoneNumber)
                putString("message", message)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            })

            // Resolve promise with status result
            promise.resolve(Arguments.createMap().apply {
                putString("status", "SENT")
                putString("phoneNumber", phoneNumber)
                putString("message", message)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            })
        } catch (e: Exception) {
            promise.reject("SMS_SEND_ERROR", "Failed to send SMS: ${e.message}", e)
        }
    }

    @ReactMethod
    fun startSmsListener(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, SoundboxService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }

            promise.resolve("SMS listener started")
        } catch (e: Exception) {
            promise.reject("LISTENER_ERROR", "Failed to start SMS listener: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stopSmsListener(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, SoundboxService::class.java)
            reactApplicationContext.stopService(intent)
            promise.resolve("SMS listener stopped")
        } catch (e: Exception) {
            promise.reject("LISTENER_ERROR", "Failed to stop SMS listener: ${e.message}", e)
        }
    }

    @ReactMethod
    fun requestSmsPermissions(promise: Promise) {
        val activity: Activity = getCurrentActivity() ?: run {
            promise.reject("NO_ACTIVITY", "No activity found")
            return
        }

        val permissions = arrayOf(
            Manifest.permission.SEND_SMS,
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_SMS
        )

        val allGranted = permissions.all {
            ContextCompat.checkSelfPermission(reactApplicationContext, it) ==
                PackageManager.PERMISSION_GRANTED
        }

        if (allGranted) {
            val result = Arguments.createMap().apply {
                putBoolean("granted", true)
            }
            promise.resolve(result)
            return
        }

        permissionPromise = promise
        if (activity is PermissionAwareActivity) {
            activity.requestPermissions(permissions, SMS_PERMISSION_REQUEST_CODE, this)
        } else {
            ActivityCompat.requestPermissions(activity, permissions, SMS_PERMISSION_REQUEST_CODE)
        }
    }

    @ReactMethod
    fun checkSmsPermissions(promise: Promise) {
        val sendGranted = ContextCompat.checkSelfPermission(
            reactApplicationContext, Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED

        val receiveGranted = ContextCompat.checkSelfPermission(
            reactApplicationContext, Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED

        val readGranted = ContextCompat.checkSelfPermission(
            reactApplicationContext, Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED

        val result = Arguments.createMap().apply {
            putBoolean("send", sendGranted)
            putBoolean("receive", receiveGranted)
            putBoolean("read", readGranted)
            putBoolean("allGranted", sendGranted && receiveGranted && readGranted)
        }
        promise.resolve(result)
    }

    @ReactMethod
    fun checkNotificationAccess(promise: Promise) {
        promise.resolve(hasNotificationAccess())
    }

    @ReactMethod
    fun openNotificationAccessSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject(
                "NOTIFICATION_SETTINGS_ERROR",
                "Failed to open notification listener settings: ${e.message}",
                e
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ): Boolean {
        if (requestCode == SMS_PERMISSION_REQUEST_CODE) {
            val allGranted = grantResults.all { it == PackageManager.PERMISSION_GRANTED }
            val result = Arguments.createMap().apply {
                putBoolean("granted", allGranted)
            }
            permissionPromise?.resolve(result)
            permissionPromise = null
            return true
        }
        return false
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun readRecentSms(count: Int, promise: Promise) {
        try {
            val merged = mutableListOf<InboxMessage>()
            val canReadSms = ContextCompat.checkSelfPermission(
                reactApplicationContext,
                Manifest.permission.READ_SMS
            ) == PackageManager.PERMISSION_GRANTED

            if (canReadSms) {
                val cursor = reactApplicationContext.contentResolver.query(
                    android.net.Uri.parse("content://sms/inbox"),
                    arrayOf("address", "body", "date"),
                    null,
                    null,
                    "date DESC LIMIT $count"
                )

                cursor?.use {
                    while (it.moveToNext()) {
                        merged.add(
                            InboxMessage(
                                sender = it.getString(0) ?: "",
                                body = it.getString(1) ?: "",
                                timestamp = it.getLong(2),
                                source = "SMS",
                            )
                        )
                    }
                }
            }

            merged.addAll(
                MessageNotificationStore
                    .getCachedNotificationMessages(reactApplicationContext, count)
                    .map {
                        InboxMessage(
                            sender = it.sender,
                            body = it.body,
                            timestamp = it.timestamp,
                            source = it.source,
                        )
                    }
            )

            val deduped = linkedMapOf<String, InboxMessage>()
            merged
                .sortedByDescending { it.timestamp }
                .forEach { msg ->
                    val key = "${msg.source}|${msg.sender}|${msg.body}|${msg.timestamp}"
                    if (!deduped.containsKey(key)) {
                        deduped[key] = msg
                    }
                }

            val messages = Arguments.createArray()
            deduped.values.take(count).forEach { msg ->
                val sms = Arguments.createMap().apply {
                    putString("sender", msg.sender)
                    putString("body", msg.body)
                    putDouble("timestamp", msg.timestamp.toDouble())
                    putString("source", msg.source)
                }
                messages.pushMap(sms)
            }

            promise.resolve(messages)
        } catch (e: Exception) {
            promise.reject("READ_SMS_ERROR", "Failed to read SMS: ${e.message}", e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
    }

    private fun hasNotificationAccess(): Boolean {
        val enabledListeners = Settings.Secure.getString(
            reactApplicationContext.contentResolver,
            "enabled_notification_listeners"
        ) ?: return false

        val component = ComponentName(reactApplicationContext, RcsNotificationListenerService::class.java)
        return enabledListeners.contains(component.flattenToString()) ||
            enabledListeners.contains(component.flattenToShortString())
    }
}
