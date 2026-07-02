package com.edgepay.app.sms

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.IBinder
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.edgepay.app.MainApplication
import com.facebook.react.ReactApplication

class SoundboxService : Service() {

    private var smsReceiver: BroadcastReceiver? = null

    companion object {
        const val CHANNEL_ID = "SoundboxServiceChannel"
        const val NOTIFICATION_ID = 1002
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        registerSmsReceiver()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterSmsReceiver()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Payment Soundbox",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): android.app.Notification {
        val appIcon = applicationContext.resources.getIdentifier("ic_launcher", "mipmap", applicationContext.packageName)
        val icon = if (appIcon != 0) appIcon else android.R.drawable.ic_lock_idle_alarm

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Payment Soundbox")
            .setContentText("Listening for incoming payments...")
            .setSmallIcon(icon)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun registerSmsReceiver() {
        if (smsReceiver != null) return

        smsReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
                    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                    for (smsMessage in messages) {
                        val sender = smsMessage.displayOriginatingAddress
                        val body = smsMessage.displayMessageBody
                        val timestamp = smsMessage.timestampMillis.toDouble()
                        
                        sendEventToReact(sender, body, timestamp)
                    }
                }
            }
        }

        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        filter.priority = IntentFilter.SYSTEM_HIGH_PRIORITY

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(smsReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(smsReceiver, filter)
        }
    }

    private fun unregisterSmsReceiver() {
        smsReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (e: Exception) {
                // Ignore
            }
            smsReceiver = null
        }
    }

    private fun sendEventToReact(sender: String?, body: String?, timestamp: Double) {
        try {
            val reactApp = application as? ReactApplication ?: return
            val reactHost = reactApp.reactHost ?: return
            val reactContext = reactHost.currentReactContext ?: return

            val params = Arguments.createMap().apply {
                putString("sender", sender ?: "")
                putString("body", body ?: "")
                putDouble("timestamp", timestamp)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(SmsModule.SMS_RECEIVED_EVENT, params)
        } catch (e: Exception) {
            // Silently fail if React context is not available
            android.util.Log.w("SoundboxService", "Failed to emit SMS event to React: ${e.message}")
        }
    }
}
