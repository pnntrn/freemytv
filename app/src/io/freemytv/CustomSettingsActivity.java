package io.freemytv;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.KeyEvent;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Button;

/** Small native controls keep setup accessible to the D-pad and soft keyboard. */
public class CustomSettingsActivity extends Activity {
    static final int[] SHORTCUT_KEYS = {0, KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_INFO,
            KeyEvent.KEYCODE_PROG_BLUE, KeyEvent.KEYCODE_PROG_RED, KeyEvent.KEYCODE_PROG_GREEN, KeyEvent.KEYCODE_PROG_YELLOW};
    private static final String[] NAMES = {"Disabled", "Menu", "Info", "Blue", "Red", "Green", "Yellow"};
    static String t(String english) { return Ui.tr(english, english); }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state); Ui.init(this);
        ScrollView scroll = new ScrollView(this);
        LinearLayout body = new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(48, 28, 48, 28); body.setBackgroundColor(0xff111827); scroll.addView(body);
        TextView title = new TextView(this); title.setText(t("Settings and CCTV")); title.setTextSize(28);
        title.setTextColor(-1); title.setTypeface(Ui.semibold); body.addView(title);
        add(body, t("Home Settings"), () -> startActivity(new Intent(this, SettingsActivity.class)));
        Button shortcut = new Button(this); shortcut.setTypeface(Ui.regular);
        Runnable refresh = () -> {
            int at = 0; for (int i = 0; i < SHORTCUT_KEYS.length; i++) if (SHORTCUT_KEYS[i] == Prefs.settingsShortcut()) at = i;
            shortcut.setText(t("Settings shortcut") + ": " + t(NAMES[at]));
        };
        refresh.run();
        shortcut.setOnClickListener(v -> {
            int at = 0; for (int i = 0; i < SHORTCUT_KEYS.length; i++) if (SHORTCUT_KEYS[i] == Prefs.settingsShortcut()) at = i;
            Prefs.setSettingsShortcut(SHORTCUT_KEYS[(at + 1) % SHORTCUT_KEYS.length]); refresh.run();
        }); body.addView(shortcut);
        add(body, t("CCTV"), () -> startActivity(new Intent(this, CctvActivity.class)));
        add(body, t("Back"), this::finish); setContentView(scroll);
    }
    private void add(LinearLayout body, String name, Runnable action) {
        Button button = new Button(this); button.setTypeface(Ui.regular); button.setText(name);
        button.setOnClickListener(v -> action.run()); body.addView(button);
    }
    static boolean shortcut(Activity activity, KeyEvent event) {
        if (Prefs.settingsShortcut() == 0 || event.getKeyCode() != Prefs.settingsShortcut()) return false;
        if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0)
            activity.startActivity(new Intent(activity, CustomSettingsActivity.class));
        return true;
    }
}
