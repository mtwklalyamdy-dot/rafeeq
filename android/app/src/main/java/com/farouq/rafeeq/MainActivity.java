package com.farouq.rafeeq;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.*;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.net.URI;
import java.util.Arrays;

public class MainActivity extends Activity {
    private static final int FILE_PICKER = 4101, AUDIO_PERMISSION = 4102;
    private WebView web;
    private ProgressBar progress;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest audioRequest;
    private String trustedHost;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(5,91,80));
        getWindow().setNavigationBarColor(Color.rgb(5,91,80));
        trustedHost = URI.create(BuildConfig.RAFEEQ_URL).getHost();
        FrameLayout root = new FrameLayout(this);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        web = new WebView(this);
        progress = new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.rgb(8,119,103)));
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));
        FrameLayout.LayoutParams bar = new FrameLayout.LayoutParams(-1,Math.round(3*getResources().getDisplayMetrics().density));
        bar.gravity=Gravity.TOP; root.addView(progress,bar); setContentView(root);
        configure();
        if(state==null) web.loadUrl(BuildConfig.RAFEEQ_URL); else web.restoreState(state);
    }

    private void configure() {
        WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(true); s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); s.setSafeBrowsingEnabled(true);
        s.setSupportMultipleWindows(false); s.setUserAgentString(s.getUserAgentString()+" RafeeqAndroid/1.0.0-release");
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return navigate(r.getUrl());}
            @Override public void onPageFinished(WebView v,String u){progress.setVisibility(View.GONE);}
            @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame()) offline();}
            @Override public void onReceivedSslError(WebView v,SslErrorHandler h,android.net.http.SslError e){h.cancel();offline();}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView v,int n){progress.setVisibility(n>=100?View.GONE:View.VISIBLE);progress.setProgress(n);}
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams p){
                if(fileCallback!=null)fileCallback.onReceiveValue(null); fileCallback=cb;
                try{startActivityForResult(p.createIntent(),FILE_PICKER);return true;}
                catch(ActivityNotFoundException e){fileCallback=null;toast(R.string.no_handler);return false;}
            }
            @Override public void onPermissionRequest(PermissionRequest r){runOnUiThread(()->webPermission(r));}
        });
        web.setDownloadListener(this::download);
    }

    private boolean navigate(Uri uri){
        String scheme=uri.getScheme()==null?"":uri.getScheme().toLowerCase();
        if("app".equals(scheme)&&"retry".equals(uri.getHost())){web.loadUrl(BuildConfig.RAFEEQ_URL);return true;}
        if(("http".equals(scheme)||"https".equals(scheme))&&trustedHost.equalsIgnoreCase(uri.getHost()))return false;
        try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(ActivityNotFoundException e){toast(R.string.no_handler);} return true;
    }

    private void webPermission(PermissionRequest r){
        boolean audio=Arrays.asList(r.getResources()).contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
        boolean trusted=trustedHost.equalsIgnoreCase(r.getOrigin().getHost());
        if(!audio||!trusted){r.deny();return;}
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)
            r.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        else{audioRequest=r;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},AUDIO_PERMISSION);}
    }

    private void download(String url,String agent,String disposition,String mime,long length){
        try{
            DownloadManager.Request r=new DownloadManager.Request(Uri.parse(url));
            String cookie=CookieManager.getInstance().getCookie(url); if(cookie!=null)r.addRequestHeader("Cookie",cookie);
            if(agent!=null)r.addRequestHeader("User-Agent",agent);
            String name=URLUtil.guessFileName(url,disposition,mime); r.setTitle(name); r.setDescription("رفيقي — جارٍ تنزيل الملف");
            r.setMimeType(mime); r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalFilesDir(this,Environment.DIRECTORY_DOWNLOADS,name);
            ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(r); toast(R.string.download_started);
        }catch(Exception e){toast(R.string.download_failed);}
    }

    private void offline(){
        String message=online()?"تعذر الاتصال بالخادم الآمن.":"لا يوجد اتصال بالإنترنت.";
        String html="<!doctype html><html dir='rtl'><meta name='viewport' content='width=device-width,initial-scale=1'><body style='margin:0;background:#f4f7f6;color:#112c28;font-family:sans-serif;display:grid;place-items:center;min-height:100vh'><main style='max-width:340px;padding:32px;text-align:center'><div style='font-size:52px'>◇</div><h1>رفيقي</h1><p style='line-height:1.8;color:#647b76'>"+message+" أعد الاتصال ثم حاول مجددًا.</p><a href='app://retry' style='display:inline-block;margin-top:16px;background:#087767;color:white;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold'>إعادة المحاولة</a><small style='display:block;margin-top:40px;color:#80928e'>© 2026 فاروق مقبول الوصابي</small></main></body></html>";
        web.loadDataWithBaseURL(BuildConfig.RAFEEQ_URL,html,"text/html","UTF-8",null);
    }

    private boolean online(){
        ConnectivityManager cm=(ConnectivityManager)getSystemService(Context.CONNECTIVITY_SERVICE); Network n=cm.getActiveNetwork();
        if(n==null)return false; NetworkCapabilities c=cm.getNetworkCapabilities(n); return c!=null&&c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }
    private void toast(int id){Toast.makeText(this,id,Toast.LENGTH_SHORT).show();}

    @Override protected void onActivityResult(int code,int result,Intent data){super.onActivityResult(code,result,data);if(code==FILE_PICKER&&fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;}}
    @Override public void onRequestPermissionsResult(int code,String[] p,int[] g){super.onRequestPermissionsResult(code,p,g);if(code==AUDIO_PERMISSION&&audioRequest!=null){if(g.length>0&&g[0]==PackageManager.PERMISSION_GRANTED)audioRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});else audioRequest.deny();audioRequest=null;}}
    @Override protected void onSaveInstanceState(Bundle out){web.saveState(out);super.onSaveInstanceState(out);}
    @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);if(audioRequest!=null)audioRequest.deny();web.destroy();super.onDestroy();}
}
