package io.freemytv;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import org.json.JSONArray;
import org.json.JSONObject;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

/** Entire profiles encrypted with a non-exportable Android Keystore AES/GCM key; excluded from backup. */
final class NvrStore {
    private static final String ALIAS = "freemytv.nvr.v1";
    private static SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
        return generator.generateKey();
    }
    private static AtomicFile file(Context c) {
        return new AtomicFile(new File(c.getNoBackupFilesDir(), "nvr-profiles.enc"));
    }
    static NvrProfile[] read(Context c) throws Exception {
        AtomicFile f = file(c);
        NvrProfile[] out = new NvrProfile[2];
        if (!f.getBaseFile().exists() && !new File(f.getBaseFile() + ".bak").exists()) return out;
        byte[] bytes = f.readFully();
        if (bytes.length < 29 || bytes.length > 32768) throw new IllegalStateException("Invalid encrypted profiles");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, java.util.Arrays.copyOf(bytes, 12)));
        JSONArray values = new JSONArray(new String(cipher.doFinal(bytes, 12, bytes.length - 12), StandardCharsets.UTF_8));
        for (int i = 0; i < 2; i++) if (!values.isNull(i)) {
            JSONObject p = values.getJSONObject(i);
            out[i] = new NvrProfile(p.getString("host"), p.getInt("port"), p.getString("username"),
                    p.getString("password"), p.getInt("channels"), p.getString("path"));
        }
        return out;
    }
    static void write(Context c, NvrProfile[] profiles) throws Exception {
        JSONArray values = new JSONArray();
        for (NvrProfile p : profiles) {
            values.put(p == null ? JSONObject.NULL : new JSONObject().put("host", p.host).put("port", p.port)
                    .put("username", p.username).put("password", p.password).put("channels", p.channels).put("path", p.path));
        }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] encrypted = cipher.doFinal(values.toString().getBytes(StandardCharsets.UTF_8));
        AtomicFile f = file(c); FileOutputStream stream = null;
        try {
            stream = f.startWrite(); stream.write(cipher.getIV()); stream.write(encrypted); f.finishWrite(stream);
        } catch (Exception e) { if (stream != null) f.failWrite(stream); throw e; }
    }
}
