package io.freemytv;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.view.WindowManager;
import android.widget.*;
import java.util.ArrayList;
import java.util.List;

/** Native RTSP viewer. Decoder capacity, authentication and VPN routing need real-device verification. */
public class CctvActivity extends Activity {
    private final List<Slot> slots = new ArrayList<>();
    private NvrProfile[] profiles;
    private LinearLayout body, toolbar;
    private GridLayout grid;
    private int nvr, page, size = 4, rows = 2, columns = 2, fullChannel;
    private boolean resumed, storageError;
    private String t(String s) { return CustomSettingsActivity.t(s); }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state); Ui.init(this);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        try { profiles = NvrStore.read(this); }
        catch (Exception e) { profiles = new NvrProfile[2]; storageError = true; }
        if (state != null) { nvr = state.getInt("nvr", 0); page = state.getInt("page", 0); }
        nvr = Math.max(0, Math.min(1, nvr));
        rows = Prefs.cctvRows(); columns = Prefs.cctvColumns(); size = NvrLayout.cells(rows, columns);
    }
    @Override protected void onResume() { super.onResume(); resumed = true; render(); }
    @Override protected void onPause() { resumed = false; release(); super.onPause(); }
    @Override protected void onSaveInstanceState(Bundle out) {
        out.putInt("nvr", nvr); out.putInt("page", page); super.onSaveInstanceState(out);
    }
    private void release() { for (Slot s : slots) s.close(); slots.clear(); }
    private String name() { return t(nvr == 0 ? "Hikvision LAN" : "VIGI via VPN"); }
    private void button(String text, Runnable run) {
        Button b = new Button(this); b.setTypeface(Ui.regular); b.setText(text);
        b.setOnClickListener(v -> run.run()); toolbar.addView(b);
    }
    private void render() {
        release(); if (!resumed) return;
        body = new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL); body.setPadding(20, 12, 20, 12);
        body.setBackgroundColor(0xff0b1020);
        toolbar = new LinearLayout(this);
        HorizontalScrollView tools = new HorizontalScrollView(this); tools.addView(toolbar); body.addView(tools);
        button(name(), () -> { nvr = 1 - nvr; page = 0; fullChannel = 0; render(); });
        button(t("Configure NVR"), this::configure);
        button(t("Grid") + " " + size, this::chooseGrid);
        button(t("Arrange"), this::arrange);
        button("‹ " + t("Previous"), () -> { page = Math.max(0, page - 1); fullChannel = 0; render(); });
        button(t("Next") + " ›", () -> { NvrProfile p = profiles[nvr]; if (p != null) page = Math.min((order().length - 1) / size, page + 1); fullChannel = 0; render(); });
        button(t("Settings"), () -> startActivity(new Intent(this, CustomSettingsActivity.class)));
        TextView status = label(storageError ? "Encrypted profiles unavailable. Reconfigure this device."
                : name() + " · " + t("Page ") + (page + 1) + " · " + t("Private LAN or VPN only."));
        body.addView(status);
        NvrProfile profile = profiles[nvr];
        grid = new GridLayout(this); int cells = fullChannel == 0 ? size : 1;
        int columnCount = fullChannel != 0 ? 1 : columns, rowCount = fullChannel != 0 ? 1 : rows;
        grid.setColumnCount(columnCount); grid.setRowCount(rowCount);
        body.addView(grid, new LinearLayout.LayoutParams(-1, 0, 1));
        if (profile == null) body.addView(label(t("Enter private NVR details on this TV.")));
        else for (int i = 0; i < cells; i++) {
            int[] arranged = order();
            int at = page * size + i;
            int channel = fullChannel == 0 ? (at < arranged.length ? arranged[at] : 0) : fullChannel;
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams(GridLayout.spec(i / columnCount, 1f), GridLayout.spec(i % columnCount, 1f));
            lp.width = 0; lp.height = 0; lp.setMargins(4, 4, 4, 4);
            if (channel == 0) { TextView empty = label(t("Empty")); empty.setBackgroundColor(0xff172033); grid.addView(empty, lp); }
            else { Slot slot = new Slot(profile, channel); slots.add(slot); grid.addView(slot.view, lp); }
        }
        setContentView(body);
    }
    private TextView label(String s) {
        TextView v = new TextView(this); v.setText(s); v.setTextColor(Color.WHITE); v.setTextSize(18);
        v.setTypeface(Ui.regular); v.setPadding(8, 8, 8, 8); return v;
    }
    private EditText field(LinearLayout fields, String name, String value, int type) {
        fields.addView(label(t(name))); EditText f = new EditText(this); f.setSingleLine(true);
        f.setInputType(type); f.setText(value); f.setTextColor(Color.WHITE); f.setTypeface(Ui.regular);
        fields.addView(f, new LinearLayout.LayoutParams(-1, -2)); return f;
    }
    private void configure() {
        release();
        NvrProfile previous = profiles[nvr];
        ScrollView scroll = new ScrollView(this);
        LinearLayout fields = new LinearLayout(this); fields.setOrientation(LinearLayout.VERTICAL);
        fields.setPadding(24, 16, 24, 16); fields.setBackgroundColor(0xff1f2937); scroll.addView(fields);
        EditText host = field(fields, "Private IPv4 address", previous == null ? "" : previous.host, InputType.TYPE_CLASS_TEXT);
        EditText port = field(fields, "Port", previous == null ? "554" : "" + previous.port, InputType.TYPE_CLASS_NUMBER);
        EditText user = field(fields, "Username", previous == null ? "" : previous.username, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        EditText password = field(fields, "Password", "", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        password.setHint(previous == null ? "" : "Leave blank to keep saved password");
        EditText channels = field(fields, "Channels", previous == null ? (nvr == 0 ? "32" : "16") : "" + previous.channels, InputType.TYPE_CLASS_NUMBER);
        EditText path = field(fields, "RTSP path template", previous == null
                ? (nvr == 0 ? "/Streaming/Channels/{channel}02" : "/ch{channel}/sub/av_stream") : previous.path, InputType.TYPE_CLASS_TEXT);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle(name()).setView(scroll)
                .setPositiveButton(t("Save"), null).setNegativeButton(t("Cancel"), null).create();
        dialog.setOnDismissListener(d -> { password.setText(""); render(); });
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            try {
                NvrProfile p = new NvrProfile(host.getText().toString().trim(), Integer.parseInt(port.getText().toString()),
                        user.getText().toString(), password.length() == 0 && previous != null ? previous.password : password.getText().toString(),
                        Integer.parseInt(channels.getText().toString()), path.getText().toString().trim());
                NvrProfile[] updated = profiles.clone(); updated[nvr] = p;
                NvrStore.write(this, updated); profiles = updated; storageError = false; page = 0;
                if (previous == null || previous.channels != p.channels) Prefs.setCctvOrder(nvr, "");
                dialog.dismiss();
            } catch (Exception e) { host.setError(t("Private LAN or VPN only.") + " Check fields or secure storage."); }
        })); dialog.show();
    }
    private int[] order() {
        try { return NvrLayout.order(Prefs.cctvOrder(nvr), profiles[nvr].channels); }
        catch (IllegalArgumentException e) { return NvrLayout.order("", profiles[nvr].channels); }
    }
    private void setGrid(int r, int c) {
        size = NvrLayout.cells(r, c); rows = r; columns = c; Prefs.setCctvGrid(r, c);
        page = 0; fullChannel = 0; render();
    }
    private void chooseGrid() {
        release();
        String[] choices = {"1 (1×1)", "4 (2×2)", "9 (3×3)", "12 (3×4)", "16 (4×4)", t("Custom")};
        AlertDialog menu = new AlertDialog.Builder(this).setTitle(t("Grid")).setItems(choices, (dialog, which) -> {
            if (which == 5) { customGrid(); return; }
            int[] r = {1, 2, 3, 3, 4}, c = {1, 2, 3, 4, 4}; setGrid(r[which], c[which]);
        }).create();
        menu.setOnCancelListener(d -> render()); menu.show();
    }
    private void customGrid() {
        LinearLayout fields = new LinearLayout(this); fields.setOrientation(LinearLayout.VERTICAL); fields.setBackgroundColor(0xff1f2937);
        EditText row = field(fields, "Rows", "" + rows, InputType.TYPE_CLASS_NUMBER);
        EditText col = field(fields, "Columns", "" + columns, InputType.TYPE_CLASS_NUMBER);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle(t("Custom")).setView(fields)
                .setPositiveButton(t("Save"), null).setNegativeButton(t("Cancel"), null).create();
        dialog.setOnDismissListener(d -> render());
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            try { setGrid(Integer.parseInt(row.getText().toString()), Integer.parseInt(col.getText().toString())); dialog.dismiss(); }
            catch (IllegalArgumentException e) { row.setError("1–4"); }
        })); dialog.show();
    }
    private void arrange() {
        if (profiles[nvr] == null) { configure(); return; } release();
        LinearLayout fields = new LinearLayout(this); fields.setOrientation(LinearLayout.VERTICAL); fields.setBackgroundColor(0xff1f2937);
        EditText sequence = field(fields, "Channel order (comma-separated, 0 = empty)", NvrLayout.text(order()), InputType.TYPE_CLASS_TEXT);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle(t("Arrange")).setView(fields)
                .setPositiveButton(t("Save"), null).setNegativeButton(t("Cancel"), null).create();
        dialog.setOnDismissListener(d -> render());
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            try {
                int[] ordered = NvrLayout.order(sequence.getText().toString(), profiles[nvr].channels);
                Prefs.setCctvOrder(nvr, NvrLayout.text(ordered)); page = 0; fullChannel = 0; dialog.dismiss();
            } catch (IllegalArgumentException e) { sequence.setError(t("Invalid channel order")); }
        })); dialog.show();
    }
    @Override public boolean dispatchKeyEvent(KeyEvent e) {
        if (CustomSettingsActivity.shortcut(this, e)) return true;
        if (e.getKeyCode() == KeyEvent.KEYCODE_BACK && fullChannel != 0) {
            if (e.getAction() == KeyEvent.ACTION_UP) { fullChannel = 0; render(); } return true;
        }
        return super.dispatchKeyEvent(e);
    }
    private final class Slot implements SurfaceHolder.Callback {
        final FrameLayout view;
        final SurfaceView surface;
        final TextView status;
        final NvrProfile profile;
        final int channel;
        final Handler handler = new Handler();
        MediaPlayer player;
        final Runnable timeout;
        Slot(NvrProfile p, int ch) {
            profile = p; channel = ch; view = new FrameLayout(CctvActivity.this);
            view.setBackgroundColor(0xff111827); view.setFocusable(true);
            surface = new SurfaceView(CctvActivity.this); view.addView(surface, new FrameLayout.LayoutParams(-1, -1));
            status = label(t("Channel ") + channel + " · " + t("Connecting…"));
            status.setBackgroundColor(0xb0111827); view.addView(status, new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM));
            view.setOnFocusChangeListener((v, focused) -> view.setBackgroundColor(focused ? 0xffff8a26 : 0xff111827));
            view.setPadding(4, 4, 4, 4);
            view.setOnClickListener(v -> { fullChannel = fullChannel == 0 ? channel : 0; render(); });
            timeout = () -> { stop(); status.setText(t("Stream unavailable. Check VPN, credentials and codec.")); };
            surface.getHolder().addCallback(this);
        }
        @Override public void surfaceCreated(SurfaceHolder holder) {
            if (!resumed) return;
            try {
                player = new MediaPlayer(); player.setDisplay(holder); player.setVolume(0, 0);
                // Credentials exist only in memory and encrypted storage. Never log this URI or exceptions.
                String auth = profile.username.isEmpty() ? "" : Uri.encode(profile.username) + ":" + Uri.encode(profile.password) + "@";
                player.setDataSource("rtsp://" + auth + profile.host + ":" + profile.port + profile.channelPath(channel));
                player.setOnPreparedListener(mp -> {
                    handler.removeCallbacks(timeout);
                    try { mp.start(); status.setText(t("Channel ") + channel); }
                    catch (RuntimeException e) { timeout.run(); }
                });
                player.setOnErrorListener((mp, what, extra) -> { timeout.run(); return true; });
                player.prepareAsync(); handler.postDelayed(timeout, 20000);
            } catch (Exception e) { timeout.run(); }
        }
        private void stop() {
            handler.removeCallbacks(timeout);
            if (player != null) {
                player.setOnErrorListener(null); player.setOnPreparedListener(null);
                try { player.release(); } catch (RuntimeException ignored) { }
                player = null;
            }
        }
        void close() { surface.getHolder().removeCallback(this); stop(); }
        @Override public void surfaceChanged(SurfaceHolder holder, int f, int w, int h) { }
        @Override public void surfaceDestroyed(SurfaceHolder holder) { stop(); }
    }
}
