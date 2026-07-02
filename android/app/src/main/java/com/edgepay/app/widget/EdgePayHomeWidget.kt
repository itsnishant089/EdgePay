package com.edgepay.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.RemoteViews
import com.edgepay.app.MainActivity
import com.edgepay.app.R
import com.edgepay.app.EdgePayAppLifecycle
import java.text.NumberFormat
import java.util.Locale

class EdgePayHomeWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            updateAppWidget(context, appWidgetManager, appWidgetId, options)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        updateAppWidget(context, appWidgetManager, appWidgetId, newOptions)
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        options: Bundle
    ) {
        val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180)
        val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)

        val layoutId = when {
            minWidth < 120 || minHeight < 100 -> R.layout.widget_home_small
            minWidth < 250 || minHeight < 200 -> R.layout.widget_home_medium
            else -> R.layout.widget_home_large
        }

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val wallet = prefs.getFloat(KEY_WALLET, 1000f)
        val bank = prefs.getFloat(KEY_BANK, 0f)
        val lastTx = prefs.getString(KEY_LAST_TX, "No recent transactions") ?: "No recent transactions"
        val balanceLabel = formatCurrency(wallet)

        val views = RemoteViews(context.packageName, layoutId)
        views.setTextViewText(R.id.widget_balance, balanceLabel)

        if (layoutId == R.layout.widget_home_large) {
            views.setTextViewText(R.id.widget_recent_tx, lastTx)
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context, appWidgetId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        when (layoutId) {
            R.layout.widget_home_small -> views.setOnClickPendingIntent(R.id.widget_balance, pendingIntent)
            R.layout.widget_home_medium -> views.setOnClickPendingIntent(R.id.btn_scan, pendingIntent)
            R.layout.widget_home_large -> views.setOnClickPendingIntent(R.id.widget_balance, pendingIntent)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    companion object {
        const val PREFS_NAME = "edgepay_widget"
        const val KEY_WALLET = "wallet_balance"
        const val KEY_BANK = "bank_balance"
        const val KEY_LAST_TX = "last_tx"

        fun syncHomeData(context: Context, walletBalance: Double, bankBalance: Double, lastTxLabel: String?) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                .putFloat(KEY_WALLET, walletBalance.toFloat())
                .putFloat(KEY_BANK, bankBalance.toFloat())
                .putFloat("balance", walletBalance.toFloat())
                .putString(KEY_LAST_TX, lastTxLabel ?: "No recent transactions")
                .apply()

            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, EdgePayHomeWidget::class.java))
            val provider = EdgePayHomeWidget()
            for (id in ids) {
                val options = mgr.getAppWidgetOptions(id)
                provider.updateAppWidget(context, mgr, id, options)
            }
            EdgePayBalanceWidget.refreshAll(context)
        }

        fun updateLastPayment(context: Context, amount: Int, sender: String, type: String, bank: String) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val sign = if (type == "CREDIT") "+" else "-"
            val label = "$sign₹$amount ${sender.take(22)} · $bank"
            var wallet = prefs.getFloat(KEY_WALLET, 1000f)
            val bankBal = prefs.getFloat(KEY_BANK, 0f)

            // When app is backgrounded, keep widget wallet in sync from SMS credits
            if (!EdgePayAppLifecycle.isForeground && type == "CREDIT") {
                wallet += amount
            }

            prefs.edit()
                .putFloat(KEY_WALLET, wallet)
                .putString(KEY_LAST_TX, label)
                .apply()

            syncHomeData(context, wallet.toDouble(), bankBal.toDouble(), label)
        }

        private fun formatCurrency(value: Float): String {
            val fmt = NumberFormat.getCurrencyInstance(Locale("en", "IN"))
            return fmt.format(value.toDouble()).replace(".00", "")
        }
    }
}
