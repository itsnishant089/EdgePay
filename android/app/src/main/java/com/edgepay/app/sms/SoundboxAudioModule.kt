package com.edgepay.app.sms

import android.media.AudioManager
import android.media.ToneGenerator
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SoundboxAudioModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var toneGenerator: ToneGenerator? = null

    companion object {
        const val NAME = "SoundboxAudio"
    }

    override fun getName(): String = NAME

    init {
        try {
            // Pre-initialize ToneGenerator for zero-latency chime
            toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun playChime(promise: Promise) {
        try {
            if (toneGenerator == null) {
                toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
            }
            // Play a high-quality double-beep similar to a success chime
            toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP2, 150)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CHIME_ERROR", "Failed to play chime", e)
        }
    }

    @ReactMethod
    fun playSuccessTone(promise: Promise) {
        try {
            if (toneGenerator == null) {
                toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
            }
            // A different tone for the end of the announcement
            toneGenerator?.startTone(ToneGenerator.TONE_PROP_ACK, 200)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TONE_ERROR", "Failed to play success tone", e)
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        toneGenerator?.release()
        toneGenerator = null
    }
}
