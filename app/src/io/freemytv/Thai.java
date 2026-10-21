package io.freemytv;
import android.content.Context;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
/** Shared dictionary from shared/th.json, copied into the APK by build.sh. */
final class Thai {
    private static JSONObject words = new JSONObject();
    static void init(Context context) {
        try (InputStream in = context.getAssets().open("th.json")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            for (int n; (n = in.read(buffer)) != -1;) out.write(buffer, 0, n);
            words = new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception ignored) { }
    }
    static String text(String english) { return words.optString(english, english); }
}
