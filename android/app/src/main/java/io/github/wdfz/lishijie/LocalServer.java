package io.github.wdfz.lishijie;

import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;

import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 只监听 127.0.0.1 的小 HTTP 服务：把 APK 里的单文件页面（assets/wdfz.html，由 tools/build_single_html.cjs 生成）交给 GeckoView。
 * 用固定端口，页面的来源（http://127.0.0.1:端口）每次都一样，浏览器存储（存档、设置、成就、档案）才能留住；
 * 端口被占用时依次试后面几个（换了端口，存档会是另一份）。
 */
final class LocalServer implements Runnable {
    static final int BASE_PORT = 47831;
    private static final String PAGE = "wdfz.html";

    private final AssetManager assets;
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    private ServerSocket socket;
    private int port;

    LocalServer(AssetManager assets) {
        this.assets = assets;
    }

    boolean start() {
        for (int p = BASE_PORT; p < BASE_PORT + 10; p++) {
            try {
                socket = new ServerSocket(p, 16, InetAddress.getByName("127.0.0.1"));
                port = p;
                Thread t = new Thread(this, "wdfz-http");
                t.setDaemon(true);
                t.start();
                return true;
            } catch (IOException ignored) {
                // 端口被占：试下一个
            }
        }
        return false;
    }

    String origin() {
        return "http://127.0.0.1:" + port;
    }

    String url() {
        return origin() + "/";
    }

    void stop() {
        try {
            if (socket != null) socket.close();
        } catch (IOException ignored) {
        }
        pool.shutdownNow();
    }

    @Override
    public void run() {
        while (socket != null && !socket.isClosed()) {
            try {
                final Socket client = socket.accept();
                pool.execute(() -> serve(client));
            } catch (IOException e) {
                if (socket.isClosed()) return;
            }
        }
    }

    private static String readLine(InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') sb.append((char) c);
            if (sb.length() > 8192) throw new IOException("header too long");
        }
        return (c == -1 && sb.length() == 0) ? null : sb.toString();
    }

    private void serve(Socket client) {
        try (Socket c = client; InputStream in = c.getInputStream(); OutputStream raw = c.getOutputStream()) {
            c.setSoTimeout(15000);
            String line = readLine(in);
            if (line == null) return;
            String header;
            while ((header = readLine(in)) != null && !header.isEmpty()) {
                // 不需要请求头
            }
            String[] parts = line.split(" ");
            String method = parts.length > 0 ? parts[0] : "";
            String path = parts.length > 1 ? parts[1] : "/";
            int q = path.indexOf('?');
            if (q >= 0) path = path.substring(0, q);
            int h = path.indexOf('#');
            if (h >= 0) path = path.substring(0, h);
            OutputStream out = new BufferedOutputStream(raw, 1 << 16);
            boolean head = "HEAD".equals(method);
            if (!"GET".equals(method) && !head) {
                status(out, "405 Method Not Allowed", "text/plain; charset=utf-8", 0);
            } else if ("/".equals(path) || "/index.html".equals(path)) {
                page(out, head);
            } else if ("/favicon.ico".equals(path)) {
                status(out, "204 No Content", "text/plain; charset=utf-8", 0);
            } else {
                byte[] body = "not found".getBytes(StandardCharsets.UTF_8);
                status(out, "404 Not Found", "text/plain; charset=utf-8", body.length);
                if (!head) out.write(body);
            }
            out.flush();
        } catch (IOException ignored) {
            // 页面关掉了、连接断了：不用管
        }
    }

    private void page(OutputStream out, boolean head) throws IOException {
        long length = -1;
        try (AssetFileDescriptor fd = assets.openFd(PAGE)) {      // 不压缩的资源才能拿到长度（build.gradle 里 noCompress 'html'）
            length = fd.getLength();
        } catch (IOException ignored) {
        }
        if (length < 0) {                                          // 万一被压缩了：读进内存再算长度
            byte[] all = readAll(assets.open(PAGE));
            status(out, "200 OK", "text/html; charset=utf-8", all.length);
            if (!head) out.write(all);
            return;
        }
        status(out, "200 OK", "text/html; charset=utf-8", length);
        if (head) return;
        try (InputStream in = assets.open(PAGE, AssetManager.ACCESS_STREAMING)) {
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        try (InputStream s = in; ByteArrayOutputStream b = new ByteArrayOutputStream()) {
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = s.read(buf)) > 0) b.write(buf, 0, n);
            return b.toByteArray();
        }
    }

    private static void status(OutputStream out, String status, String type, long length) throws IOException {
        String head = "HTTP/1.1 " + status + "\r\n"
                + "Content-Type: " + type + "\r\n"
                + "Content-Length: " + length + "\r\n"
                + "Cache-Control: no-cache\r\n"
                + "X-Content-Type-Options: nosniff\r\n"
                + "Connection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.US_ASCII));
    }
}
