package io.freemytv;

/** Deliberately accepts only RFC1918 IPv4 literals: no public NVRs or DNS rebinding. */
final class NvrProfile {
    final String host, username, password, path;
    final int port, channels;
    NvrProfile(String host, int port, String username, String password, int channels, String path) {
        if (!privateAddress(host) || port < 1 || port > 65535 || channels < 1 || channels > 64
                || path == null || !path.startsWith("/") || channels > 1 && !path.contains("{channel}")
                || !path.matches("[A-Za-z0-9_./{}-]+") || path.startsWith("//") || path.contains("..")
                || username == null || password == null || username.length() > 256 || password.length() > 256)
            throw new IllegalArgumentException("Invalid private NVR profile");
        this.host = host; this.port = port; this.username = username; this.password = password;
        this.channels = channels; this.path = path;
    }
    static boolean privateAddress(String host) {
        if (host == null || !host.matches("[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+")) return false;
        String[] parts = host.split("\\.");
        int[] n = new int[4];
        for (int i = 0; i < 4; i++) {
            if (parts[i].length() > 3 || (parts[i].length() > 1 && parts[i].startsWith("0"))) return false;
            try { n[i] = Integer.parseInt(parts[i]); } catch (NumberFormatException e) { return false; }
            if (n[i] > 255) return false;
        }
        return n[0] == 10 || n[0] == 172 && n[1] >= 16 && n[1] <= 31 || n[0] == 192 && n[1] == 168;
    }
    String channelPath(int channel) {
        if (channel < 1 || channel > channels) throw new IllegalArgumentException("Invalid channel");
        return path.replace("{channel}", Integer.toString(channel));
    }
}
