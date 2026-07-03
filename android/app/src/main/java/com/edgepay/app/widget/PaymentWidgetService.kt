package com.edgepay.app.widget

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.app.*
import android.content.*
import android.graphics.PixelFormat
import android.os.*
import android.provider.Telephony
import android.speech.tts.TextToSpeech
import android.view.*
import android.widget.*
import androidx.core.app.NotificationCompat
import com.edgepay.app.MainActivity
import com.edgepay.app.R
import com.edgepay.app.EdgePayAppLifecycle
import java.util.*
import android.view.animation.OvershootInterpolator

class PaymentWidgetService : Service(), TextToSpeech.OnInitListener {

    companion object {
        const val CHANNEL_ID = "edgepay_widget_channel"
        const val NOTIFICATION_ID = 8001
        const val ACTION_STOP = "com.edgepay.app.widget.STOP"
        const val ACTION_SHOW_QUICK_PAY = "com.edgepay.app.widget.SHOW_QUICK_PAY"
        const val ACTION_SHOW_FINANCE = "com.edgepay.app.widget.SHOW_FINANCE"
        const val ACTION_HIDE_WIDGETS = "com.edgepay.app.widget.HIDE_WIDGETS"
        const val ACTION_PROCESS_MESSAGE = "com.edgepay.app.widget.PROCESS_MESSAGE"
        
        const val EXTRA_LANGUAGE = "language"
        const val EXTRA_ANNOUNCE_CREDITS = "announceCredits"
        const val EXTRA_ANNOUNCE_DEBITS = "announceDebits"
        const val EXTRA_SENDER = "sender"
        const val EXTRA_BODY = "body"
        const val EXTRA_TIMESTAMP = "timestamp"

        var isRunning = false
    }

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var smsReceiver: BroadcastReceiver? = null

    private var windowManager: WindowManager? = null
    
    // The three overlays
    private var soundboxView: View? = null
    private var quickPayView: View? = null
    private var financeView: View? = null

    private var overlayHandler: Handler? = null
    private var dismissRunnable: Runnable? = null

    private var language = "en"
    private var announceCredits = true
    private var announceDebits = false
    private val recentKeys = ArrayDeque<Pair<String, Long>>()
    private val pendingSpeechQueue = ArrayDeque<PaymentInfo>()

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        createNotificationChannel()
        tts = TextToSpeech(this, this)
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        overlayHandler = Handler(Looper.getMainLooper())
        registerSmsReceiver()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_SHOW_QUICK_PAY -> {
                showQuickPayWidget()
                return START_STICKY
            }
            ACTION_SHOW_FINANCE -> {
                showFinanceWidget()
                return START_STICKY
            }
            ACTION_HIDE_WIDGETS -> {
                hideAllWidgets()
                return START_STICKY
            }
        }

        language = intent?.getStringExtra(EXTRA_LANGUAGE) ?: language
        announceCredits = intent?.getBooleanExtra(EXTRA_ANNOUNCE_CREDITS, true) ?: announceCredits
        announceDebits = intent?.getBooleanExtra(EXTRA_ANNOUNCE_DEBITS, false) ?: announceDebits

        startForeground(NOTIFICATION_ID, buildNotification())

        if (intent?.action == ACTION_PROCESS_MESSAGE) {
            val sender = intent.getStringExtra(EXTRA_SENDER).orEmpty()
            val body = intent.getStringExtra(EXTRA_BODY).orEmpty()
            if (body.isNotBlank()) {
                processIncomingSms(sender, body)
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        unregisterSmsReceiver()
        hideAllWidgets()
        tts?.stop()
        tts?.shutdown()
        overlayHandler?.removeCallbacksAndMessages(null)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val locale = if (language == "hi") Locale("hi", "IN") else Locale("en", "IN")
            val result = tts?.setLanguage(locale)
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts?.setLanguage(Locale.ENGLISH)
            }
            tts?.setSpeechRate(0.9f)
            ttsReady = true
            flushPendingSpeech()
        }
    }

    private fun registerSmsReceiver() {
        smsReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
                val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                for (msg in messages) {
                    processIncomingSms(msg.displayOriginatingAddress ?: "", msg.displayMessageBody ?: "")
                }
            }
        }
        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        filter.priority = IntentFilter.SYSTEM_HIGH_PRIORITY
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(smsReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(smsReceiver, filter)
        }
    }

    private fun unregisterSmsReceiver() {
        smsReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
            smsReceiver = null
        }
    }

    private fun processIncomingSms(sender: String, body: String) {
        val info = SmsPaymentParser.parse(sender, body) ?: return
        val key = "${info.type}_${info.amount}_${info.sender}_${info.refNumber ?: ""}"
        val now = System.currentTimeMillis()
        recentKeys.removeAll { now - it.second > 60_000 }
        if (recentKeys.any { it.first == key }) return
        recentKeys.addLast(key to now)

        // Always store last payment for home widget
        overlayHandler?.post {
            EdgePayHomeWidget.updateLastPayment(this, info.amount.toInt(), info.sender, info.type, info.bank)
        }

        // When React is in foreground, JS soundbox handles TTS + wallet — avoid duplicate voice
        if (EdgePayAppLifecycle.isForeground) return

        // Only announce and show overlay for credits when app is backgrounded
        if (info.type != "CREDIT") return
        if (!announceCredits) return

        overlayHandler?.post {
            showSoundboxWidget(info)
            announcePayment(info)
        }
    }

    private fun announcePayment(info: PaymentInfo) {
        if (info.type != "CREDIT") return
        if (!ttsReady) {
            pendingSpeechQueue.addLast(info)
            return
        }
        val rupees = info.amount.toInt()
        val paise = Math.round((info.amount - rupees) * 100)
        val amountSpeech = if (paise > 0) "$rupees rupees and $paise paise" else "$rupees rupees"
        val text = if (language == "hi") {
            "क्रेडिट अलर्ट। $amountSpeech प्राप्त हुए।"
        } else {
            "Credit alert. $amountSpeech credited."
        }
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "edgepay_payment")
    }

    private fun flushPendingSpeech() {
        while (ttsReady && pendingSpeechQueue.isNotEmpty()) {
            announcePayment(pendingSpeechQueue.removeFirst())
        }
    }

    // ── Overlays ───────────────────────────────────────────────────

    private fun getOverlayLayoutParams(): WindowManager.LayoutParams {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            WindowManager.LayoutParams.TYPE_PHONE
        }
        return WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = 100
        }
    }

    private fun animateEntrance(view: View) {
        view.alpha = 0f
        view.scaleX = 0.8f
        view.scaleY = 0.8f
        view.animate()
            .alpha(1f)
            .scaleX(1f)
            .scaleY(1f)
            .setDuration(300)
            .setInterpolator(OvershootInterpolator())
            .start()
    }

    private fun hideAllWidgets() {
        soundboxView?.let { windowManager?.removeView(it); soundboxView = null }
        quickPayView?.let { windowManager?.removeView(it); quickPayView = null }
        financeView?.let { windowManager?.removeView(it); financeView = null }
    }

    private fun showSoundboxWidget(info: PaymentInfo) {
        hideAllWidgets()
        val inflater = getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater
        soundboxView = inflater.inflate(R.layout.widget_floating_soundbox, null)
        
        soundboxView?.findViewById<TextView>(R.id.text_amount)?.text = "₹${info.amount}"
        soundboxView?.findViewById<TextView>(R.id.text_sender)?.text = "From ${info.sender}"
        soundboxView?.findViewById<LinearLayout>(R.id.payment_details_container)?.visibility = View.VISIBLE
        
        soundboxView?.findViewById<ImageView>(R.id.btn_close)?.setOnClickListener {
            hideAllWidgets()
        }

        windowManager?.addView(soundboxView, getOverlayLayoutParams())
        soundboxView?.let { animateEntrance(it) }

        // Auto dismiss
        dismissRunnable?.let { overlayHandler?.removeCallbacks(it) }
        dismissRunnable = Runnable { hideAllWidgets() }
        overlayHandler?.postDelayed(dismissRunnable!!, 5000)
    }

    private fun showQuickPayWidget() {
        hideAllWidgets()
        val inflater = getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater
        quickPayView = inflater.inflate(R.layout.widget_quick_pay, null)
        
        quickPayView?.findViewById<ImageView>(R.id.btn_close)?.setOnClickListener {
            hideAllWidgets()
        }
        quickPayView?.findViewById<Button>(R.id.btn_scan)?.setOnClickListener {
            openAppTo("QRScan")
        }

        windowManager?.addView(quickPayView, getOverlayLayoutParams())
        quickPayView?.let { animateEntrance(it) }
    }

    private fun showFinanceWidget() {
        hideAllWidgets()
        val inflater = getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater
        financeView = inflater.inflate(R.layout.widget_finance_dashboard, null)
        
        financeView?.findViewById<ImageView>(R.id.btn_close)?.setOnClickListener {
            hideAllWidgets()
        }
        
        // Populate dummy data for now or fetch from SharedPreferences
        val prefs = getSharedPreferences("edgepay_widget", Context.MODE_PRIVATE)
        val balance = prefs.getFloat("balance", 0f)
        financeView?.findViewById<TextView>(R.id.text_balance)?.text = "₹$balance"

        windowManager?.addView(financeView, getOverlayLayoutParams())
        financeView?.let { animateEntrance(it) }
    }

    private fun openAppTo(screen: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("targetScreen", screen)
        }
        startActivity(intent)
        hideAllWidgets()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "EdgePay Widget", NotificationManager.IMPORTANCE_LOW)
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("EdgePay Widget Active")
            .setContentText("Listening for payments...")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
