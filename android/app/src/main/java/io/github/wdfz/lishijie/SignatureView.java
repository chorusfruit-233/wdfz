package io.github.wdfz.lishijie;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.util.AttributeSet;
import android.view.View;

import java.util.Random;

/**
 * 启动时的 DeepShawn 签名动画（门之前）：
 * · 0–0.5 秒：扫描线、四角取景框、「SIG://」代码一个字一个字打出来
 * · 0.4–3.7 秒：一支光笔从左往右把签名「写」出来——笔尖沿着每一列笔画的重心走、颜色取那里的墨色，
 *   身后是拖尾和火花，前沿有一道竖的激光扫描线，已写出的部分带软边
 * · 3.7–4.5 秒：一道斜光扫过签名，光晕亮一下
 * · 4.5–5.0 秒：停住
 * · 5.0–5.7 秒：故障消散（横条错位、红青分离、闪一下）到全黑
 * 动画完了回调 {@link #setOnDone}；{@link #skip()} 直接结束。
 */
public final class SignatureView extends View {
    static final long WRITE_AT = 400, WRITE_MS = 3300, SWEEP_AT = 3700, SWEEP_MS = 800, GLITCH_AT = 5000, END_AT = 5700;
    private static final String CODE = "SIG://DEEPSHAWN  ·  AUTH OK";

    private final Bitmap sig, glow;
    private final float[] trackY;                     // 每一列笔画的重心（0..1）
    private final int[] trackC;                       // 每一列的墨色
    private final Paint bmp = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
    private final Paint add = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
    private final Paint mask = new Paint();
    private final Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint hud = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint red = new Paint(Paint.FILTER_BITMAP_FLAG), cyan = new Paint(Paint.FILTER_BITMAP_FLAG);
    private final Rect src = new Rect();
    private final RectF box = new RectF(), dst = new RectF();
    private final Random rnd = new Random(7);
    private final float dp;

    private static final int SPARKS = 160, TRAIL = 28;
    private final float[] sx = new float[SPARKS], sy = new float[SPARKS], svx = new float[SPARKS], svy = new float[SPARKS], slife = new float[SPARKS], sage = new float[SPARKS];
    private final int[] scol = new int[SPARKS];
    private int sparkNext;
    private final float[] tx = new float[TRAIL], ty = new float[TRAIL];
    private int trailN;

    private long start = -1, last;
    private boolean done;
    private Runnable onDone;

    public SignatureView(Context c) {
        this(c, null);
    }

    public SignatureView(Context c, AttributeSet a) {
        super(c, a);
        dp = c.getResources().getDisplayMetrics().density;
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inScaled = false;
        sig = BitmapFactory.decodeResource(c.getResources(), R.drawable.signature, o);
        glow = BitmapFactory.decodeResource(c.getResources(), R.drawable.signature_glow, o);
        int w = sig.getWidth(), h = sig.getHeight();
        trackY = new float[w];
        trackC = new int[w];
        buildTrack(w, h);
        add.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.ADD));
        mask.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.DST_IN));
        line.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.ADD));
        line.setStrokeCap(Paint.Cap.ROUND);
        hud.setStyle(Paint.Style.STROKE);
        hud.setStrokeWidth(1.2f * dp);
        text.setTypeface(Typeface.MONOSPACE);
        text.setTextSize(10f * dp);
        text.setLetterSpacing(0.18f);
        red.setColorFilter(new ColorMatrixColorFilter(new ColorMatrix(new float[]{1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0})));
        cyan.setColorFilter(new ColorMatrixColorFilter(new ColorMatrix(new float[]{0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0})));
        red.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.ADD));
        cyan.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.ADD));
        setLayerType(LAYER_TYPE_HARDWARE, null);
    }

    /** 每一列：亮度加权的纵向重心和平均颜色；没有墨的列沿用旁边的，再来回各平滑一遍，笔尖走得顺。 */
    private void buildTrack(int w, int h) {
        int[] px = new int[w * h];
        sig.getPixels(px, 0, w, 0, 0, w, h);
        float prev = 0.5f;
        int prevC = Color.WHITE;
        for (int x = 0; x < w; x++) {
            double sum = 0, ys = 0, r = 0, g = 0, b = 0;
            for (int y = 0; y < h; y += 2) {
                int p = px[y * w + x];
                int al = p >>> 24;
                if (al < 90) continue;
                double wt = al * al;
                sum += wt;
                ys += wt * y;
                r += wt * ((p >> 16) & 255);
                g += wt * ((p >> 8) & 255);
                b += wt * (p & 255);
            }
            if (sum > 0) {
                prev = (float) (ys / sum / h);
                prevC = Color.rgb((int) (r / sum), (int) (g / sum), (int) (b / sum));
            }
            trackY[x] = prev;
            trackC[x] = prevC;
        }
        for (int pass = 0; pass < 2; pass++) {
            float k = 0.06f;
            for (int x = 1; x < w; x++) trackY[x] += (trackY[x - 1] - trackY[x]) * (1 - k);
            for (int x = w - 2; x >= 0; x--) trackY[x] += (trackY[x + 1] - trackY[x]) * (1 - k);
        }
    }

    void setOnDone(Runnable r) {
        onDone = r;
    }

    void skip() {
        finish();
    }

    private void finish() {
        if (done) return;
        done = true;
        if (onDone != null) post(onDone);
    }

    private static float clamp(float v) {
        return v < 0 ? 0 : (v > 1 ? 1 : v);
    }

    private static float ease(float t) {                 // 起笔、收笔慢，中间快
        t = clamp(t);
        return t * t * (3 - 2 * t) * 0.85f + t * 0.15f;
    }

    @Override
    protected void onDraw(Canvas c) {
        long now = SystemClock.uptimeMillis();
        if (start < 0) { start = now; last = now; }
        long t = now - start;
        float dt = Math.min(0.05f, (now - last) / 1000f);
        last = now;
        int W = getWidth(), H = getHeight();
        c.drawColor(Color.BLACK);
        if (W == 0 || H == 0) { postInvalidateOnAnimation(); return; }

        float bw = Math.min(W * 0.82f, H * 0.5f * sig.getWidth() / sig.getHeight());
        float bh = bw * sig.getHeight() / sig.getWidth();
        box.set((W - bw) / 2f, (H - bh) / 2f - H * 0.02f, (W + bw) / 2f, (H + bh) / 2f - H * 0.02f);

        float fadeOut = t < GLITCH_AT ? 1f : 1f - clamp((t - GLITCH_AT) / (float) (END_AT - GLITCH_AT));
        drawBackdrop(c, W, H, t, fadeOut);

        float wp = ease((t - WRITE_AT) / (float) WRITE_MS);
        float revealX = box.left + bw * wp;
        if (t < GLITCH_AT) drawInk(c, t, wp, revealX, bw);
        else drawGlitch(c, t, fadeOut);

        if (t >= WRITE_AT && t < WRITE_AT + WRITE_MS + 120) drawPen(c, wp, revealX, bw, bh, dt);
        drawSparks(c, dt, fadeOut);
        if (t >= SWEEP_AT && t < SWEEP_AT + SWEEP_MS) drawSweep(c, (t - SWEEP_AT) / (float) SWEEP_MS);

        if (t >= END_AT) { finish(); return; }
        postInvalidateOnAnimation();
    }

    /* 背景：扫描线、四角取景框、代码行 */
    private void drawBackdrop(Canvas c, int W, int H, long t, float fade) {
        float a = clamp(t / 500f) * fade;
        line.setStrokeWidth(1f);
        line.setColor(Color.argb((int) (10 * a), 120, 200, 255));
        float step = 3f * dp;
        for (float y = (t * 0.02f) % step; y < H; y += step) c.drawLine(0, y, W, y, line);
        float sweepY = (t * 0.25f * dp) % (H + 80 * dp) - 40 * dp;             // 一条慢慢往下走的亮扫描带
        line.setStrokeWidth(28f * dp);
        line.setShader(new LinearGradient(0, sweepY - 14 * dp, 0, sweepY + 14 * dp,
                new int[]{0, Color.argb((int) (16 * a), 90, 170, 255), 0}, null, Shader.TileMode.CLAMP));
        c.drawLine(0, sweepY, W, sweepY, line);
        line.setShader(null);

        float m = 14 * dp, L = 18 * dp;
        RectF b = new RectF(box.left - m, box.top - m, box.right + m, box.bottom + m);
        float grow = 0.6f + 0.4f * clamp(t / 600f);
        hud.setColor(Color.argb((int) (150 * a), 140, 210, 255));
        float cx = b.centerX(), cy = b.centerY(), hw = b.width() / 2 * grow, hh = b.height() / 2 * grow;
        float l = cx - hw, r = cx + hw, tp = cy - hh, bt = cy + hh;
        c.drawLine(l, tp, l + L, tp, hud); c.drawLine(l, tp, l, tp + L, hud);
        c.drawLine(r, tp, r - L, tp, hud); c.drawLine(r, tp, r, tp + L, hud);
        c.drawLine(l, bt, l + L, bt, hud); c.drawLine(l, bt, l, bt - L, hud);
        c.drawLine(r, bt, r - L, bt, hud); c.drawLine(r, bt, r, bt - L, hud);

        int n = (int) Math.min(CODE.length(), Math.max(0, (t - 200) / 70));
        if (t > 3900) n = CODE.length();
        else if (n > 16) n = 16;                                                   // 写的时候停在「SIG://DEEPSHAWN」，写完才打出 AUTH OK
        String s = CODE.substring(0, n) + ((t / 260) % 2 == 0 && t < GLITCH_AT ? "▌" : " ");
        text.setColor(Color.argb((int) (170 * a), 150, 215, 255));
        c.drawText(s, l, bt + 18 * dp, text);
        text.setColor(Color.argb((int) (90 * a), 150, 215, 255));
        String pct = String.format(java.util.Locale.ROOT, "%03d%%", (int) (100 * ease((t - WRITE_AT) / (float) WRITE_MS)));
        c.drawText(pct, r - text.measureText(pct), tp - 8 * dp, text);
    }

    /* 已写出的签名（软边）＋光晕 */
    private void drawInk(Canvas c, long t, float wp, float revealX, float bw) {
        if (wp <= 0) return;
        float feather = 26 * dp;
        int save = c.saveLayer(box.left - 40 * dp, box.top - 40 * dp, box.right + 40 * dp, box.bottom + 40 * dp, null);
        float pulse = t > SWEEP_AT ? 1f + 0.6f * (float) Math.sin(Math.PI * clamp((t - SWEEP_AT) / 900f)) : 1f;
        add.setAlpha((int) Math.min(255, 150 * pulse));
        dst.set(box.left - bw * 0.03f, box.top - bw * 0.03f, box.right + bw * 0.03f, box.bottom + bw * 0.03f);
        c.drawBitmap(glow, null, dst, add);
        bmp.setAlpha(255);
        c.drawBitmap(sig, null, box, bmp);
        if (wp < 1) {
            mask.setShader(new LinearGradient(revealX - feather, 0, revealX, 0, Color.BLACK, Color.TRANSPARENT, Shader.TileMode.CLAMP));
            c.drawRect(box.left - 40 * dp, box.top - 40 * dp, box.right + 40 * dp, box.bottom + 40 * dp, mask);
            mask.setShader(null);
        }
        c.restoreToCount(save);
    }

    private int colAt(float frac) {
        int i = Math.max(0, Math.min(trackC.length - 1, (int) (frac * (trackC.length - 1))));
        return trackC[i];
    }

    private float yAt(float frac) {
        int i = Math.max(0, Math.min(trackY.length - 1, (int) (frac * (trackY.length - 1))));
        return box.top + trackY[i] * box.height();
    }

    /* 光笔：竖的激光扫描线、拖尾、笔尖光点，并往外撒火花 */
    private void drawPen(Canvas c, float wp, float revealX, float bw, float bh, float dt) {
        float px = revealX, py = yAt(wp);
        py += (float) Math.sin(SystemClock.uptimeMillis() / 37.0) * 1.2f * dp;   // 手写的细抖
        int col = colAt(wp);
        float fade = wp >= 1 ? 0.4f : 1f;

        line.setStrokeWidth(1.4f * dp);
        line.setShader(new LinearGradient(0, box.top - 20 * dp, 0, box.bottom + 20 * dp,
                new int[]{0, Color.argb((int) (120 * fade), 110, 200, 255), 0}, null, Shader.TileMode.CLAMP));
        c.drawLine(px, box.top - 20 * dp, px, box.bottom + 20 * dp, line);
        line.setStrokeWidth(14 * dp);
        line.setShader(new LinearGradient(0, box.top, 0, box.bottom,
                new int[]{0, Color.argb((int) (22 * fade), 110, 200, 255), 0}, null, Shader.TileMode.CLAMP));
        c.drawLine(px - 7 * dp, box.top, px - 7 * dp, box.bottom, line);
        line.setShader(null);

        System.arraycopy(tx, 0, tx, 1, TRAIL - 1);
        System.arraycopy(ty, 0, ty, 1, TRAIL - 1);
        tx[0] = px; ty[0] = py;
        if (trailN < TRAIL) trailN++;
        for (int i = 1; i < trailN; i++) {
            float k = 1f - i / (float) TRAIL;
            line.setStrokeWidth((1 + 5 * k) * dp);
            line.setColor(withAlpha(col, (int) (200 * k * k * fade)));
            c.drawLine(tx[i - 1], ty[i - 1], tx[i], ty[i], line);
        }

        float r = 26 * dp;
        Paint tip = new Paint(Paint.ANTI_ALIAS_FLAG);
        tip.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.ADD));
        tip.setShader(new RadialGradient(px, py, r, new int[]{Color.argb((int) (255 * fade), 255, 255, 255), withAlpha(col, (int) (170 * fade)), 0},
                new float[]{0f, 0.18f, 1f}, Shader.TileMode.CLAMP));
        c.drawCircle(px, py, r, tip);
        line.setStrokeWidth(1f * dp);                                            // 十字星芒
        line.setColor(Color.argb((int) (150 * fade), 255, 255, 255));
        c.drawLine(px - r * 1.4f, py, px + r * 1.4f, py, line);
        c.drawLine(px, py - r * 0.8f, px, py + r * 0.8f, line);

        if (wp < 1) for (int k = 0; k < 4; k++) spawn(px, py, col);
    }

    private void spawn(float x, float y, int col) {
        int i = sparkNext;
        sparkNext = (sparkNext + 1) % SPARKS;
        double ang = Math.PI + (rnd.nextDouble() - 0.5) * 2.6;                  // 多半往身后（左边）飞
        float sp = (40 + rnd.nextFloat() * 220) * dp;
        sx[i] = x; sy[i] = y;
        svx[i] = (float) Math.cos(ang) * sp;
        svy[i] = (float) Math.sin(ang) * sp - 30 * dp;
        slife[i] = 0.35f + rnd.nextFloat() * 0.6f;
        sage[i] = 0;
        scol[i] = rnd.nextFloat() < 0.35f ? Color.WHITE : col;
    }

    private void drawSparks(Canvas c, float dt, float fade) {
        for (int i = 0; i < SPARKS; i++) {
            if (slife[i] <= 0) continue;
            sage[i] += dt;
            if (sage[i] >= slife[i]) { slife[i] = 0; continue; }
            svy[i] += 160 * dp * dt;
            svx[i] *= 1 - 1.8f * dt;
            float ox = sx[i], oy = sy[i];
            sx[i] += svx[i] * dt;
            sy[i] += svy[i] * dt;
            float k = 1 - sage[i] / slife[i];
            line.setStrokeWidth((0.8f + 1.6f * k) * dp);
            line.setColor(withAlpha(scol[i], (int) (230 * k * fade)));
            c.drawLine(ox - (sx[i] - ox) * 1.5f, oy - (sy[i] - oy) * 1.5f, sx[i], sy[i], line);
        }
    }

    /* 写完：一道斜光扫过签名（只亮在笔画上） */
    private void drawSweep(Canvas c, float p) {
        float span = box.width() + box.height() * 2;
        float cx = box.left - box.height() + span * p;
        int save = c.saveLayer(box, null);
        c.drawBitmap(sig, null, box, bmp);
        Paint band = new Paint();
        band.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        band.setShader(new LinearGradient(cx - 60 * dp, box.top, cx + 60 * dp, box.bottom,
                new int[]{0, Color.argb(235, 255, 255, 255), 0}, null, Shader.TileMode.CLAMP));
        c.drawRect(box, band);
        c.restoreToCount(save);
        add.setAlpha((int) (140 * Math.sin(Math.PI * p)));                      // 光扫过时，光晕亮一下
        dst.set(box.left - box.width() * 0.05f, box.top - box.width() * 0.05f, box.right + box.width() * 0.05f, box.bottom + box.width() * 0.05f);
        c.drawBitmap(glow, null, dst, add);
    }

    /* 故障消散：横条错位、红青分离、越来越暗，中间闪一下 */
    private void drawGlitch(Canvas c, long t, float fade) {
        rnd.setSeed(t / 45);
        int bands = 14;
        int sw = sig.getWidth(), sh = sig.getHeight();
        float amp = (1 - fade) * 46 * dp + 4 * dp;
        int alpha = (int) (255 * fade);
        for (int i = 0; i < bands; i++) {
            int y0 = sh * i / bands, y1 = sh * (i + 1) / bands;
            float off = rnd.nextFloat() < 0.45f ? (rnd.nextFloat() - 0.5f) * 2 * amp : 0;
            if (rnd.nextFloat() < (1 - fade) * 0.5f) continue;                  // 有的横条直接没了
            src.set(0, y0, sw, y1);
            float dy0 = box.top + box.height() * y0 / sh, dy1 = box.top + box.height() * y1 / sh;
            float split = (2 + (1 - fade) * 9) * dp;
            red.setAlpha(alpha);
            cyan.setAlpha(alpha);
            dst.set(box.left + off + split, dy0, box.right + off + split, dy1);
            c.drawBitmap(sig, src, dst, red);
            dst.set(box.left + off - split, dy0, box.right + off - split, dy1);
            c.drawBitmap(sig, src, dst, cyan);
        }
        long g = t - GLITCH_AT;
        if (g > 150 && g < 210) c.drawColor(Color.argb(40, 200, 230, 255), PorterDuff.Mode.ADD);
    }

    private static int withAlpha(int col, int a) {
        return (Math.max(0, Math.min(255, a)) << 24) | (col & 0xFFFFFF);
    }
}
