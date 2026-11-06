package io.github.wdfz.lishijie;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.MediaPlayer;
import android.util.Log;
import android.animation.ValueAnimator;
import android.content.pm.ActivityInfo;
import android.graphics.drawable.Animatable;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.widget.ImageView;
import android.widget.Toast;

import org.mozilla.geckoview.AllowOrDeny;
import org.mozilla.geckoview.GeckoResult;
import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoRuntimeSettings;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoSessionSettings;
import org.mozilla.geckoview.GeckoView;

/**
 * 里世界 3D 安卓版：用 APK 自带的 GeckoView（Mozilla Gecko 引擎，自己的 WebGL 与排版）跑单文件页面，
 * 不用 Android 系统 WebView。
 * · 全屏沉浸、常亮；旋转不重建（Manifest 的 configChanges），游戏不会重新载入
 * · 返回键：先发一次 Esc 给游戏（暂停、关面板）；1.5 秒内再按一次回到桌面（游戏留在后台）
 * · 不是本机页面的链接（Wiki、仓库）交给系统浏览器
 * · 导入 DLC 文件：用系统的文件选择器
 * · 启动动画（应用自己的启动层，Android 12 起系统启动画面只是一下黑场）：
 *   ① DeepShawn 签名书写动画（{@link SignatureView}，约 5.7 秒）
 *   ② 黑场约 2.6 秒，门的轮廓在黑里暗闪两下
 *   ③ 门打开、标题渐显、底部红线跟着页面载入进度走；游戏页面画出来、门打开后至少 1.8 秒才淡出；最多 25 秒保底
 *   点一下屏幕：签名／黑场直接跳到门；门那段页面已画出来就直接进游戏
 * · 横屏：默认横屏（左右都行）；游戏设置关掉「自动横屏」时，页面请求本机服务 /__app/orientation 改成跟随系统。
 *   App 自己记住页面上次的选择（SharedPreferences），启动时、回到前台时都按它重新锁一次，不只靠 Manifest
 * · 声音：允许页面自动播放（主菜单一打开就有 BGM）：GeckoView 配置文件把 media.autoplay.default 设成允许，PermissionDelegate 也放行；
 *   启动层（签名 → 黑场 → 门）放 App 自己的原生音乐 res/raw/splash_music.wav，游戏画面出来时渐弱，接上游戏的 BGM；
 *   页面通过 /__app/audio 告诉 App 音乐开关和音量，App 记住，下次启动照这个放
 * · 设备诊断：页面的报告和报错通过 /__app/log 写进系统日志（标签 WDFZ）；启动参数 --es query diag=1 时打开 GeckoView 控制台输出，
 *   页面自动跑诊断路线（CI 的安卓模拟器用，tools/android_diag.sh）
 * · 页面地址带 ?app=android：游戏据此隐藏「进入全屏」按钮（App 本来就全屏）
 */
public class MainActivity extends Activity {
    private static final int REQ_FILE = 7;
    private static final long SPLASH_MIN_MS = 1800, SPLASH_MAX_MS = 25000, SPLASH_FADE_MS = 450, DARK_MS = 2600;
    private static final Object DARK = new Object();                // 黑场里排着的回调（暗闪、开门），跳过时一起取消
    private static GeckoRuntime runtime;                 // 整个进程只能有一个

    private GeckoSession session;
    private GeckoView view;
    private LocalServer server;
    private long lastBack;
    private boolean hinted;
    private GeckoResult<GeckoSession.PromptDelegate.PromptResponse> pendingFile;
    private GeckoSession.PromptDelegate.FilePrompt pendingPrompt;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private View splash;
    private View splashBar, doorBox;
    private SignatureView sign;
    private long doorAt;
    private int phase;                                                 // 0 签名  1 黑场  2 门
    private boolean splashGone, painted;
    private boolean landscape = true;                                  // 游戏设置「自动横屏」（默认开）
    private MediaPlayer music;
    private String extraQuery = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_main);
        view = findViewById(R.id.gecko);
        landscape = prefs().getBoolean("landscape", true);
        applyOrientation();
        immersive();
        startSplash();

        String q = getIntent() != null ? getIntent().getStringExtra("query") : null;
        if (q != null && q.matches("[A-Za-z0-9=&_.-]{1,200}")) extraQuery = "&" + q;
        startMusic();
        server = new LocalServer(getAssets(), new LocalServer.Listener() {
            @Override
            public void onOrientation(boolean want) {
                runOnUiThread(() -> {
                    if (want != landscape) prefs().edit().putBoolean("landscape", want).apply();
                    landscape = want;
                    applyOrientation();
                });
            }

            @Override
            public void onAudio(boolean on, int volume) {
                prefs().edit().putBoolean("music", on).putInt("volume", volume).apply();
            }

            @Override
            public void onLog(String message) {
                for (int i = 0; i < message.length(); i += 3000) Log.i("WDFZ", message.substring(i, Math.min(message.length(), i + 3000)));
            }
        });
        if (!server.start()) {
            Toast.makeText(this, R.string.server_failed, Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        if (runtime == null) {
            GeckoRuntimeSettings settings = new GeckoRuntimeSettings.Builder()
                    .javaScriptEnabled(true)
                    .remoteDebuggingEnabled(false)
                    .consoleOutput(extraQuery.contains("diag=1"))      // 诊断时页面的 console 进系统日志（标签 GeckoConsole）
                    .configFilePath(writeGeckoConfig())
                    .build();
            runtime = GeckoRuntime.create(getApplicationContext(), settings);
        }
        openSession();
    }

    private void openSession() {
        session = new GeckoSession(new GeckoSessionSettings.Builder()
                .usePrivateMode(false)                                   // 存档、设置要留在设备上
                .userAgentMode(GeckoSessionSettings.USER_AGENT_MODE_MOBILE)
                .viewportMode(GeckoSessionSettings.VIEWPORT_MODE_MOBILE)
                .build());
        session.setNavigationDelegate(new Navigation());
        session.setContentDelegate(new Content());
        session.setPromptDelegate(new Prompts());
        session.setProgressDelegate(new Progress());
        session.setPermissionDelegate(new Permissions());
        session.open(runtime);
        view.setSession(session);
        session.loadUri(server.url() + "?app=android" + extraQuery);
    }

    /* GeckoView 的配置文件：允许页面自动出声（Web Audio 和媒体），不用先等一下点击 */
    private String writeGeckoConfig() {
        java.io.File f = new java.io.File(getFilesDir(), "geckoview-config.yaml");
        String yaml = "prefs:\n"
                + "  media.autoplay.default: 0\n"
                + "  media.autoplay.blocking_policy: 0\n"
                + "  media.autoplay.block-webaudio: false\n"
                + "  media.autoplay.block-event.enabled: false\n";
        try (java.io.FileOutputStream out = new java.io.FileOutputStream(f)) {
            out.write(yaml.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (java.io.IOException e) {
            Log.w("WDFZ", "gecko config: " + e);
        }
        return f.getAbsolutePath();
    }

    /* 启动层的原生音乐：签名开始就有，跟着签名 → 黑场 → 门的时间轴；游戏页面出来时渐弱 */
    private void startMusic() {
        SharedPreferences p = prefs();
        if (!p.getBoolean("music", true)) return;
        float v = Math.max(0f, Math.min(1f, p.getInt("volume", 70) / 100f));
        if (v <= 0f) return;
        try {
            music = MediaPlayer.create(this, R.raw.splash_music);
            if (music == null) return;
            music.setVolume(v, v);
            music.setOnCompletionListener(mp -> stopMusic(0));
            music.start();
        } catch (Exception e) {
            Log.w("WDFZ", "splash music: " + e);
            music = null;
        }
    }

    private void stopMusic(long fadeMs) {
        final MediaPlayer mp = music;
        if (mp == null) return;
        music = null;
        if (fadeMs <= 0) { try { mp.release(); } catch (Exception ignored) { } return; }
        final float v0 = Math.max(0f, Math.min(1f, prefs().getInt("volume", 70) / 100f));
        ValueAnimator a = ValueAnimator.ofFloat(1f, 0f);
        a.setDuration(fadeMs);
        a.addUpdateListener(an -> { try { float k = (float) an.getAnimatedValue(); mp.setVolume(v0 * k, v0 * k); } catch (Exception ignored) { } });
        a.addListener(new android.animation.AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(android.animation.Animator animation) {
                try { mp.stop(); mp.release(); } catch (Exception ignored) { }
            }
        });
        a.start();
    }

    private SharedPreferences prefs() {
        return getSharedPreferences("wdfz", MODE_PRIVATE);
    }

    /* 开：横屏（左右两个方向都行）；关：跟随系统的旋转设置 */
    private void applyOrientation() {
        int want = landscape ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_FULL_USER;
        if (getRequestedOrientation() != want) setRequestedOrientation(want);
    }

    private boolean isLocal(String uri) {
        return uri == null || uri.startsWith(server.origin() + "/") || uri.equals(server.origin())
                || uri.startsWith("blob:") || uri.startsWith("data:") || uri.startsWith("about:") || uri.startsWith("javascript:");
    }

    private void openExternal(String uri) {
        runOnUiThread(() -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(uri)));
            } catch (ActivityNotFoundException ignored) {
            }
        });
    }

    private final class Navigation implements GeckoSession.NavigationDelegate {
        @Override
        public GeckoResult<AllowOrDeny> onLoadRequest(GeckoSession s, LoadRequest request) {
            if (isLocal(request.uri)) return GeckoResult.allow();
            openExternal(request.uri);
            return GeckoResult.deny();
        }

        @Override
        public GeckoResult<GeckoSession> onNewSession(GeckoSession s, String uri) {
            openExternal(uri);                                           // 新窗口（Wiki 等）在系统浏览器里打开
            return null;
        }
    }

    private final class Content implements GeckoSession.ContentDelegate {
        @Override
        public void onFullScreen(GeckoSession s, boolean fullScreen) {
            immersive();                                                 // 一直是全屏：游戏里的「进入全屏」也一样
        }

        @Override
        public void onFirstContentfulPaint(GeckoSession s) {
            painted = true;                                              // 游戏页面第一次画出来了
            hideSplash();
        }

        @Override
        public void onCrash(GeckoSession s) {
            restart();
        }

        @Override
        public void onKill(GeckoSession s) {
            restart();
        }
    }

    private final class Progress implements GeckoSession.ProgressDelegate {
        @Override
        public void onProgressChange(GeckoSession s, int progress) {
            if (splashBar != null && !splashGone && phase == 2) splashBar.animate().scaleX(Math.max(0.04f, progress / 100f)).setDuration(240).start();
        }
    }

    /* 允许页面自动播放声音：主菜单一打开就有 BGM，不用先点一下 */
    private static final class Permissions implements GeckoSession.PermissionDelegate {
        @Override
        public GeckoResult<Integer> onContentPermissionRequest(GeckoSession s, ContentPermission perm) {
            if (perm.permission == PERMISSION_AUTOPLAY_AUDIBLE || perm.permission == PERMISSION_AUTOPLAY_INAUDIBLE)
                return GeckoResult.fromValue(ContentPermission.VALUE_ALLOW);
            return null;                                                 // 其他权限：照 GeckoView 默认处理
        }
    }

    /* ---------- 启动层：① 签名书写 → ② 黑场（门暗闪）→ ③ 门打开、标题、载入进度 ---------- */
    private void startSplash() {
        splash = findViewById(R.id.splash);
        splashBar = findViewById(R.id.splashBar);
        doorBox = findViewById(R.id.splashDoorBox);
        sign = findViewById(R.id.splashSign);
        splashBar.setPivotX(0);
        splashBar.setScaleX(0.04f);
        phase = 0;
        sign.setOnDone(this::darkPause);
        splash.setOnClickListener(v -> skipSplash());
        ui.postDelayed(() -> hideSplash(true), SPLASH_MAX_MS);           // 保底：页面迟迟没画出来也不一直挡着
    }

    /* ② 黑场：什么都没有，只有门的轮廓在黑里暗闪两下，然后才开门 */
    private void darkPause() {
        if (phase != 0 || splashGone) return;
        phase = 1;
        sign.setVisibility(View.GONE);
        long t = SystemClock.uptimeMillis();
        float[][] flicker = {{700, 0.10f}, {760, 0f}, {1380, 0.05f}, {1440, 0.16f}, {1500, 0f}, {1560, 0.06f}, {1640, 0f}};
        for (float[] f : flicker) {
            final float alpha = f[1];
            ui.postAtTime(() -> doorBox.setAlpha(alpha), DARK, t + (long) f[0]);
        }
        ui.postAtTime(this::openDoor, DARK, t + DARK_MS);
    }

    /* ③ 门打开、标题渐显、载入进度 */
    private void openDoor() {
        if (phase == 2 || splashGone) return;
        if (phase == 0) sign.skip();
        phase = 2;
        ui.removeCallbacksAndMessages(DARK);
        sign.setVisibility(View.GONE);
        doorAt = SystemClock.uptimeMillis();
        doorBox.animate().cancel();
        doorBox.setAlpha(0f);
        doorBox.animate().alpha(1f).setDuration(500).start();
        ImageView door = findViewById(R.id.splashDoor);
        Drawable d = door.getDrawable();
        if (d instanceof Animatable) ((Animatable) d).start();
        splashBar.animate().alpha(1f).setDuration(400).start();
        DecelerateInterpolator ease = new DecelerateInterpolator(1.6f);
        View title = findViewById(R.id.splashTitle), sub = findViewById(R.id.splashSub);
        title.setTranslationY(18f);
        sub.setTranslationY(12f);
        title.animate().alpha(1f).translationY(0f).setStartDelay(650).setDuration(900).setInterpolator(ease).start();
        sub.animate().alpha(1f).translationY(0f).setStartDelay(1050).setDuration(800).setInterpolator(ease).start();
        hideSplash();
    }

    /* 点一下：签名／黑场直接到门；门那段页面已画出来就直接进游戏 */
    private void skipSplash() {
        if (phase < 2) openDoor();
        else if (painted) hideSplash(true);
    }

    private void hideSplash() {
        hideSplash(false);
    }

    private void hideSplash(boolean now) {
        runOnUiThread(() -> {
            if (splashGone || splash == null) return;
            if (!now) {
                if (!painted || phase < 2) return;                       // 还在签名／黑场：开门时再看
                long wait = SPLASH_MIN_MS - (SystemClock.uptimeMillis() - doorAt);
                if (wait > 0) { ui.postDelayed(this::hideSplash, wait); return; }   // 门的动画至少演完一遍
            }
            splashGone = true;
            ui.removeCallbacksAndMessages(null);
            stopMusic(2200);                                             // 渐弱，接上游戏自己的 BGM
            if (sign != null) sign.skip();
            splashBar.animate().scaleX(1f).setDuration(200).start();
            splash.animate().alpha(0f).setStartDelay(120).setDuration(SPLASH_FADE_MS)
                    .withEndAction(() -> { splash.setVisibility(View.GONE); sign.setVisibility(View.GONE); view.requestFocus(); }).start();
        });
    }

    private void restart() {
        runOnUiThread(() -> {
            try {
                session.close();
            } catch (Exception ignored) {
            }
            openSession();                                               // 页面进程没了：重新打开（存档在浏览器存储里）
        });
    }

    private final class Prompts implements GeckoSession.PromptDelegate {
        @Override
        public GeckoResult<PromptResponse> onFilePrompt(GeckoSession s, FilePrompt prompt) {
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("*/*");
            GeckoResult<PromptResponse> result = new GeckoResult<>();
            pendingFile = result;
            pendingPrompt = prompt;
            try {
                startActivityForResult(Intent.createChooser(pick, null), REQ_FILE);
            } catch (ActivityNotFoundException e) {
                pendingFile = null;
                Toast.makeText(MainActivity.this, R.string.no_file_app, Toast.LENGTH_SHORT).show();
                return GeckoResult.fromValue(prompt.dismiss());
            }
            return result;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || pendingFile == null) return;
        GeckoResult<GeckoSession.PromptDelegate.PromptResponse> r = pendingFile;
        pendingFile = null;
        if (resultCode == RESULT_OK && data != null && data.getData() != null) r.complete(pendingPrompt.confirm(this, data.getData()));
        else r.complete(pendingPrompt.dismiss());
    }

    /* 返回键：先发 Esc（游戏里是暂停、关面板）；1.5 秒内再按一次回到桌面 */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_UP) {
                long now = SystemClock.uptimeMillis();
                if (now - lastBack < 1500) {
                    moveTaskToBack(true);
                } else {
                    sendEscape();
                    if (!hinted) {
                        hinted = true;
                        Toast.makeText(this, "1.5 秒内再按一次返回键回到桌面", Toast.LENGTH_SHORT).show();
                    }
                }
                lastBack = now;
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private void sendEscape() {
        long t = SystemClock.uptimeMillis();
        view.requestFocus();
        view.dispatchKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ESCAPE, 0));
        view.dispatchKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ESCAPE, 0));
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (music != null) try { music.pause(); } catch (Exception ignored) { }
        if (session != null) session.setActive(false);                   // 页面收到「切到后台」：游戏自己会暂停
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (session != null) session.setActive(true);
        if (music != null && !splashGone) try { music.start(); } catch (Exception ignored) { }
        applyOrientation();
        immersive();
    }

    @Override
    protected void onDestroy() {
        ui.removeCallbacksAndMessages(null);
        stopMusic(0);
        if (session != null) session.close();
        if (server != null) server.stop();
        super.onDestroy();
    }

    @SuppressWarnings("deprecation")
    private void immersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }
}
