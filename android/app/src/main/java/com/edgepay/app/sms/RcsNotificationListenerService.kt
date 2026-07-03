package com.edgepay.app.sms

import android.app.Notification
import android.content.Intent
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.edgepay.app.EdgePayAppLifecycle
import com.edgepay.app.widget.PaymentWidgetService
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class RcsNotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "RcsNotificationListener"
        private const val SOURCE = "RCS_NOTIFICATION"

        private val SUPPORTED_PACKAGES = setOf(
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging",
            "com.android.mms",
            "com.oneplus.mms",
        )

        private val RELEVANT_KEYWORDS = listOf(
            "BALANCE",
            "ACCOUNT",
            "A/C",
            "CREDIT",
            "DEBIT",
            "BANK",
            "UPI",
            "INR",
            "RS",
            "HDFC",
            "SBI",
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        if (!isSupportedMessagingPackage(sbn.packageName)) return
        if (isGroupSummary(sbn.notification)) return

        val sender = extractSender(sbn.notification)
        val body = extractBody(sbn.notification) ?: return
        if (!looksRelevant(sender, body)) return

        val timestamp = if (sbn.postTime > 0) sbn.postTime else System.currentTimeMillis()
        val isNewMessage = MessageNotificationStore.cacheNotificationMessage(
            applicationContext,
            sender,
            body,
            timestamp,
            SOURCE,
        )
        if (!isNewMessage) return

        if (EdgePayAppLifecycle.isForeground) {
            emitToReact(sender, body, timestamp)
        } else {
            handoffToBackgroundAnnouncement(sender, body, timestamp)
        }
    }

    private fun emitToReact(sender: String, body: String, timestamp: Long) {
        try {
            val reactApp = application as? ReactApplication ?: return
            val reactContext = reactApp.reactHost?.currentReactContext ?: return
            val params = Arguments.createMap().apply {
                putString("sender", sender)
                putString("body", body)
                putDouble("timestamp", timestamp.toDouble())
                putString("source", SOURCE)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(SmsModule.SMS_RECEIVED_EVENT, params)
        } catch (err: Exception) {
            Log.w(TAG, "Failed to emit RCS message to React: ${err.message}")
        }
    }

    private fun handoffToBackgroundAnnouncement(sender: String, body: String, timestamp: Long) {
        val intent = Intent(this, PaymentWidgetService::class.java).apply {
            action = PaymentWidgetService.ACTION_PROCESS_MESSAGE
            putExtra(PaymentWidgetService.EXTRA_SENDER, sender)
            putExtra(PaymentWidgetService.EXTRA_BODY, body)
            putExtra(PaymentWidgetService.EXTRA_TIMESTAMP, timestamp)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        } catch (err: Exception) {
            Log.w(TAG, "Failed to handoff RCS message to widget service: ${err.message}")
        }
    }

    private fun extractSender(notification: Notification): String {
        val extras = notification.extras ?: return ""
        return listOf(
            extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString(),
            extras.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
            extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString(),
        )
            .firstOrNull { !it.isNullOrBlank() }
            ?.trim()
            .orEmpty()
    }

    private fun extractBody(notification: Notification): String? {
        val extras = notification.extras ?: return null
        val candidates = mutableListOf<String>()
        val textLines = extras
            .getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
            ?.mapNotNull { line ->
                line?.toString()?.trim()?.takeIf { it.isNotBlank() }
            }
            .orEmpty()
        val messageStyleTexts = extractMessagingStyleTexts(extras)

        if (textLines.isNotEmpty()) {
            candidates.add(textLines.joinToString("\n"))
            candidates.add(textLines.joinToString(" "))
            candidates.addAll(textLines)
        }
        if (messageStyleTexts.isNotEmpty()) {
            candidates.add(messageStyleTexts.joinToString("\n"))
            candidates.add(messageStyleTexts.joinToString(" "))
            candidates.addAll(messageStyleTexts)
        }

        extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim()?.let {
            if (it.isNotBlank()) candidates.add(it)
        }
        extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim()?.let {
            if (it.isNotBlank()) candidates.add(it)
        }
        extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)?.toString()?.trim()?.let {
            if (it.isNotBlank()) candidates.add(it)
        }

        return candidates
            .map { normalizeCandidate(it) }
            .filterNot { looksLikeNotificationSummary(it) }
            .distinct()
            .maxByOrNull { scoreCandidate(it) }
    }

    private fun extractMessagingStyleTexts(extras: android.os.Bundle): List<String> {
        val texts = mutableListOf<String>()
        val arrays = listOf(
            extras.getParcelableArray(Notification.EXTRA_MESSAGES),
            extras.getParcelableArray(Notification.EXTRA_HISTORIC_MESSAGES),
        )

        arrays.forEach { bundleArray ->
            if (bundleArray == null) return@forEach
            try {
                val messages = Notification.MessagingStyle.Message.getMessagesFromBundleArray(bundleArray)
                messages.forEach { message ->
                    val value = message.text?.toString()?.trim().orEmpty()
                    if (value.isNotBlank()) {
                        texts.add(value)
                    }
                }
            } catch (_: Exception) {
                // Some OEM messaging apps don't expose standard MessagingStyle bundles.
            }
        }

        return texts
    }

    private fun normalizeCandidate(text: String): String {
        val lines = text
            .split('\n')
            .map { it.replace(Regex("\\s+"), " ").trim() }
            .filter { it.isNotBlank() }

        val deduped = mutableListOf<String>()
        lines.forEach { line ->
            if (!deduped.lastOrNull().equals(line, ignoreCase = true)) {
                deduped.add(line)
            }
        }

        return deduped.joinToString("\n")
    }

    private fun scoreCandidate(text: String): Int {
        val upper = text.uppercase()
        var score = text.length.coerceAtMost(160)

        if (Regex("""\b(BALANCE|ACCOUNT BALANCE|AVAILABLE BALANCE|AVL BAL)\b""").containsMatchIn(upper)) {
            score += 220
        }
        if (Regex("""\b(CREDIT ALERT|CREDITED|DEBITED|WITHDRAWN|UPI)\b""").containsMatchIn(upper)) {
            score += 140
        }
        if (Regex("""(?:₹|RS\.?|INR)\s*[\d,]+(?:\.\d+)?""", RegexOption.IGNORE_CASE).containsMatchIn(text)) {
            score += 180
        }
        if (upper.contains("HDFC")) {
            score += 40
        }
        if (looksLikeActionChip(upper)) {
            score -= 250
        }

        return score
    }

    private fun looksRelevant(sender: String, body: String): Boolean {
        val upper = "${sender.uppercase()} ${body.uppercase()}"
        return RELEVANT_KEYWORDS.any { upper.contains(it) }
    }

    private fun isSupportedMessagingPackage(packageName: String?): Boolean {
        if (packageName.isNullOrBlank()) return false
        if (SUPPORTED_PACKAGES.contains(packageName)) return true

        val normalized = packageName.lowercase()
        return normalized.contains("messaging") || normalized.contains("mms")
    }

    private fun looksLikeNotificationSummary(text: String): Boolean {
        val normalized = text.trim().lowercase()
        return normalized == "new message" ||
            normalized.endsWith(" new messages") ||
            normalized.endsWith(" new message") ||
            normalized == "try chatbanking" ||
            normalized == "book fd"
    }

    private fun looksLikeActionChip(text: String): Boolean {
        val normalized = text.trim()
        return normalized == "TRY CHATBANKING" || normalized == "BOOK FD"
    }

    private fun isGroupSummary(notification: Notification): Boolean {
        return notification.flags and Notification.FLAG_GROUP_SUMMARY != 0
    }
}
