package io.freemytv;
/** Camera ordering is independent of streams. Zero is an empty slot; repeated cameras are rejected. */
final class NvrLayout {
    static int cells(int rows, int columns) {
        if (rows < 1 || rows > 4 || columns < 1 || columns > 4) throw new IllegalArgumentException("Grid must be 1..4 by 1..4");
        return rows * columns;
    }
    static int[] order(String value, int channels) {
        if (channels < 1 || channels > 64) throw new IllegalArgumentException("Invalid channels");
        if (value == null || value.trim().isEmpty()) {
            int[] all = new int[channels]; for (int i = 0; i < channels; i++) all[i] = i + 1; return all;
        }
        String[] parts = value.split(",", -1);
        if (parts.length > 128) throw new IllegalArgumentException("Too many slots");
        int[] out = new int[parts.length]; boolean[] seen = new boolean[channels + 1];
        for (int i = 0; i < parts.length; i++) {
            String text = parts[i].trim();
            if (!text.matches("[0-9]{1,2}")) throw new IllegalArgumentException("Invalid channel order");
            int ch = Integer.parseInt(text);
            if (ch > channels || ch > 0 && seen[ch]) throw new IllegalArgumentException("Invalid channel order");
            out[i] = ch; if (ch > 0) seen[ch] = true;
        }
        return out;
    }
    static String text(int[] order) {
        StringBuilder out = new StringBuilder();
        for (int ch : order) { if (out.length() > 0) out.append(','); out.append(ch); }
        return out.toString();
    }
}
