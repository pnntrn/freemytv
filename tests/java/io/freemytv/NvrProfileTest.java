package io.freemytv;
final class NvrProfileTest {
    public static void main(String[] args) {
        String[] good = {"10.0.0.1", "172.16.0.1", "172.31.255.254", "192.168.10.2"};
        String[] bad = {"8.8.8.8", "127.0.0.1", "0.0.0.0", "169.254.1.1", "172.15.1.1",
                "172.32.1.1", "192.169.0.1", "10.0.0.256", "010.0.0.1", "10.1", "10.1.2.3.evil",
                "192.168.1.1@evil.com", "example.com", "::1", "10.0.0.1\n", "10.0.0.1:554"};
        for (String s : good) if (!NvrProfile.privateAddress(s)) throw new AssertionError(s);
        for (String s : bad) if (NvrProfile.privateAddress(s)) throw new AssertionError(s);
        NvrProfile p = new NvrProfile("192.168.1.10", 554, "viewer", "never-log-this", 32, "/Streaming/Channels/{channel}02");
        if (!p.channelPath(21).equals("/Streaming/Channels/2102")) throw new AssertionError("channel path");
        reject(() -> p.channelPath(33)); reject(() -> p.channelPath(0));
        reject(() -> new NvrProfile("8.8.8.8", 554, "", "", 16, "/ch{channel}/sub/av_stream"));
        reject(() -> new NvrProfile("10.0.0.1", 0, "", "", 16, "/ch{channel}"));
        reject(() -> new NvrProfile("10.0.0.1", 554, "", "", 65, "/ch{channel}"));
        reject(() -> new NvrProfile("10.0.0.1", 554, "", "", 16, "//evil/{channel}"));
        if (NvrLayout.cells(3,4) != 12 || NvrLayout.cells(4,4) != 16) throw new AssertionError("grid size");
        reject(() -> NvrLayout.cells(0,4)); reject(() -> NvrLayout.cells(4,5));
        int[] order = NvrLayout.order("3,1,0,2", 32);
        if (!NvrLayout.text(order).equals("3,1,0,2")) throw new AssertionError("custom arrangement");
        if (NvrLayout.order("",32).length != 32) throw new AssertionError("default order");
        reject(() -> NvrLayout.order("1,1",32)); reject(() -> NvrLayout.order("33",32));
        reject(() -> NvrLayout.order("1,",32)); reject(() -> NvrLayout.order("-1",32));
        NvrProfile camera = new NvrProfile("10.0.0.1",554,"","",1,"/stream1");
        if (!camera.channelPath(1).equals("/stream1")) throw new AssertionError("generic camera");
        System.out.println("NVR input and channel boundary checks passed");
    }
    private static void reject(Runnable fn) {
        try { fn.run(); throw new AssertionError("Expected rejection"); }
        catch (IllegalArgumentException expected) { }
    }
}
