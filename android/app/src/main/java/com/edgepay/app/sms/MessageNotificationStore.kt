package com.edgepay.app.sms

import android.content.Context
import kotlin.math.abs
import org.json.JSONArray
import org.json.JSONObject

data class CachedMessage(
    val sender: String,
    val body: String,
    val timestamp: Long,
    val source: String,
)

object MessageNotificationStore {
    private const val PREFS_NAME = "edgepay_message_cache"
    private const val KEY_MESSAGES = "cached_message_notifications"
    private const val MAX_STORED_MESSAGES = 40
    private const val DEDUPE_WINDOW_MS = 5_000L

    fun cacheNotificationMessage(
        context: Context,
        sender: String,
        body: String,
        timestamp: Long,
        source: String = "RCS_NOTIFICATION",
    ): Boolean {
        val cleanSender = sender.trim()
        val cleanBody = body.trim()
        if (cleanBody.isBlank()) return false

        val existing = getCachedNotificationMessages(context, MAX_STORED_MESSAGES).toMutableList()
        val duplicate = existing.any {
            it.sender == cleanSender &&
                it.body == cleanBody &&
                abs(it.timestamp - timestamp) <= DEDUPE_WINDOW_MS
        }
        if (duplicate) return false

        existing.add(
            0,
            CachedMessage(
                sender = cleanSender,
                body = cleanBody,
                timestamp = timestamp,
                source = source,
            ),
        )

        saveMessages(context, existing.sortedByDescending { it.timestamp }.take(MAX_STORED_MESSAGES))
        return true
    }

    fun getCachedNotificationMessages(
        context: Context,
        limit: Int = MAX_STORED_MESSAGES,
    ): List<CachedMessage> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_MESSAGES, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            val messages = mutableListOf<CachedMessage>()
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                val body = item.optString("body").trim()
                if (body.isBlank()) continue
                messages.add(
                    CachedMessage(
                        sender = item.optString("sender").trim(),
                        body = body,
                        timestamp = item.optLong("timestamp"),
                        source = item.optString("source", "RCS_NOTIFICATION"),
                    ),
                )
            }
            messages
                .sortedByDescending { it.timestamp }
                .take(limit.coerceAtLeast(1))
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveMessages(context: Context, messages: List<CachedMessage>) {
        val array = JSONArray()
        messages.forEach { msg ->
            array.put(
                JSONObject().apply {
                    put("sender", msg.sender)
                    put("body", msg.body)
                    put("timestamp", msg.timestamp)
                    put("source", msg.source)
                },
            )
        }

        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_MESSAGES, array.toString())
            .apply()
    }
}
