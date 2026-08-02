package com.tool.app;

import android.Manifest;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import ai.moonshine.voice.MicTranscriber;

@CapacitorPlugin(
        name = "MoonshineSpeech",
        permissions = @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
)
public class MoonshineSpeechPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile boolean startRequested;
    private volatile boolean listening;
    private MicTranscriber microphone;
    private String loadedLanguage;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        startWithPermission(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission is required for voice input.");
            return;
        }
        startWithPermission(call);
    }

    private void startWithPermission(PluginCall call) {
        if (listening || startRequested) {
            JSObject result = new JSObject();
            result.put("listening", true);
            call.resolve(result);
            return;
        }

        startRequested = true;
        String language = call.getString("language", "vi");
        notifyStatus("loading", "Preparing the on-device Moonshine model");
        worker.execute(() -> {
            try {
                if (microphone == null || !language.equals(loadedLanguage)) {
                    if (microphone != null) microphone.close();
                    loadedLanguage = language;
                    microphone = new MicTranscriber(getContext())
                            .language(language)
                            .onLine(line -> {
                                if (line.text == null || line.text.trim().isEmpty()) return;
                                JSObject event = new JSObject();
                                event.put("text", line.text.trim());
                                notifyListeners("transcript", event);
                            })
                            .onProgress((fraction, file) -> notifyProgress(fraction, file))
                            .onError(error -> notifyError(error.getMessage()));
                    microphone.load();
                }

                if (!startRequested) {
                    notifyStatus("stopped", "Voice input stopped");
                    JSObject result = new JSObject();
                    result.put("listening", false);
                    call.resolve(result);
                    return;
                }

                microphone.start();
                listening = true;
                notifyStatus("listening", "Listening on device");
                JSObject result = new JSObject();
                result.put("listening", true);
                call.resolve(result);
            } catch (Throwable error) {
                startRequested = false;
                listening = false;
                notifyError(error.getMessage());
                call.reject("Moonshine failed to start", new Exception(error));
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        startRequested = false;
        listening = false;
        if (microphone != null) microphone.stop();
        notifyStatus("stopped", "Voice input stopped");
        call.resolve();
    }

    private void notifyProgress(float fraction, String file) {
        JSObject event = new JSObject();
        event.put("state", "loading");
        event.put("progress", fraction);
        event.put("file", file);
        notifyListeners("status", event);
    }

    private void notifyStatus(String state, String message) {
        JSObject event = new JSObject();
        event.put("state", state);
        event.put("message", message);
        notifyListeners("status", event);
    }

    private void notifyError(String message) {
        notifyStatus("error", message == null ? "Unknown Moonshine error" : message);
    }

    @Override
    protected void handleOnDestroy() {
        startRequested = false;
        listening = false;
        if (microphone != null) microphone.close();
        worker.shutdownNow();
    }
}
