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
import java.text.NumberFormat
import java.util.Locale

/**
 * Wallet + Bank Balance Widget — resize-aware (small / large layouts).
 */
class EdgePayBalanceWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) {
            val options = appWidgetManager.getAppWidgetOptions(id)
            updateWidget(context, appWidgetManager, id, options)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        updateWidget(context, appWidgetManager, appWidgetId, newOptions)
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
    }

    companion object {
        const val KEY_TODAY_SPENT = "today_spent"

        fun syncBalanceData(
            context: Context,
            walletBalance: Double,
            bankBalance: Double,
            todaySpent: Double,
            lastTxLabel: String?
        ) {
            val prefs = context.getSharedPreferences(EdgePayHomeWidget.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putFloat(EdgePayHomeWidget.KEY_WALLET, walletBalance.toFloat())
                .putFloat(EdgePayHomeWidget.KEY_BANK, bankBalance.toFloat())
                .putFloat(KEY_TODAY_SPENT, todaySpent.toFloat())
                .putString(EdgePayHomeWidget.KEY_LAST_TX, lastTxLabel ?: "No recent transactions")
                .apply()
            refreshAll(context)
        }

        fun refreshAll(context: Context) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, EdgePayBalanceWidget::class.java))
            for (id in ids) {
                val options = mgr.getAppWidgetOptions(id)
                updateWidget(context, mgr, id, options)
            }
        }

        private fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
            options: Bundle
        ) {
            val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 140)
            val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
            val layoutId = if (minWidth >= 200 && minHeight >= 120) {
                R.layout.widget_balance_large
            } else {
                R.layout.widget_balance_small
            }

            val prefs = context.getSharedPreferences(EdgePayHomeWidget.PREFS_NAME, Context.MODE_PRIVATE)
            val wallet = prefs.getFloat(EdgePayHomeWidget.KEY_WALLET, 1000f)
            val bank = prefs.getFloat(EdgePayHomeWidget.KEY_BANK, 0f)
            val todaySpent = prefs.getFloat(KEY_TODAY_SPENT, 0f)
            val lastTx = prefs.getString(EdgePayHomeWidget.KEY_LAST_TX, "No recent transactions") ?: "No recent transactions"

            val views = RemoteViews(context.packageName, layoutId)
            views.setTextViewText(R.id.balance_widget_wallet, formatCurrency(wallet))
            views.setTextViewText(R.id.balance_widget_bank, if (bank > 0) formatCurrency(bank) else "Bank ••••")

            if (layoutId == R.layout.widget_balance_large) {
                views.setTextViewText(R.id.balance_widget_spent, "Today: ${formatCurrency(todaySpent)} spent")
                views.setTextViewText(R.id.balance_widget_last_tx, lastTx)
            }

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pending = PendingIntent.getActivity(
                context, appWidgetId + 200, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.balance_widget_container, pending)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun formatCurrency(value: Float): String {
            val fmt = NumberFormat.getCurrencyInstance(Locale("en", "IN"))
            return fmt.format(value.toDouble()).replace(".00", "")
        }
    }
}
