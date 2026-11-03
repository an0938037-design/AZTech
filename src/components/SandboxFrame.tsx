import { useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, RefreshCw, ShieldCheck, X } from "lucide-react";
import type { SandboxArtifact } from "../types";

const GUARD_JS = `
(function(){
  function send(type,payload){
    try{ parent.postMessage(Object.assign({type:type},payload||{}),"*"); }catch(e){}
  }
  function denied(){ return Promise.reject(new Error("Network bị chặn trong sandbox.")); }
  try{ window.fetch=function(){ return denied(); }; }catch(e){}
  try{ window.XMLHttpRequest=function(){ throw new Error("Network bị chặn trong sandbox."); }; }catch(e){}
  try{ window.WebSocket=function(){ throw new Error("WebSocket bị chặn trong sandbox."); }; }catch(e){}
  try{ window.EventSource=function(){ throw new Error("EventSource bị chặn trong sandbox."); }; }catch(e){}
  try{ navigator.sendBeacon=function(){ return false; }; }catch(e){}
  try{ window.open=function(){ return null; }; }catch(e){}
  try{
    window.alert=function(){};
    window.confirm=function(){ return false; };
    window.prompt=function(){ return null; };
  }catch(e){}
  window.addEventListener("error",function(event){
    send("sandbox:error",{message:String(event.message||"Lỗi trong sandbox.")});
  });
  window.addEventListener("unhandledrejection",function(event){
    var reason=event.reason;
    send("sandbox:error",{message:String(reason&&reason.message?reason.message:reason||"Promise bị từ chối.")});
  });
  var lastHeight=-1;
  function sendHeight(){
    var root=document.documentElement;
    var body=document.body;
    var height=Math.max(root?root.scrollHeight:0,body?body.scrollHeight:0,320);
    height=Math.min(height,4000);
    if(Math.abs(height-lastHeight)>1){
      lastHeight=height;
      send("sandbox:height",{height:height});
    }
  }
  window.addEventListener("load",sendHeight);
  window.addEventListener("resize",sendHeight);
  if(window.ResizeObserver){
    try{ new ResizeObserver(sendHeight).observe(document.documentElement); }catch(e){}
  }
  setTimeout(sendHeight,60);
  setTimeout(sendHeight,420);
})();
`;

function buildDocument(artifact: SandboxArtifact): string {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none';">
<style>
html,body{margin:0;min-height:1px;background:#0a0a0a;color:#f5f5f5;font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif}
*{box-sizing:border-box}
</style>
<style>${artifact.css || ""}</style>
</head>
<body>
<script>${GUARD_JS}</script>
${artifact.html || ""}
<script>${artifact.js || ""}</script>
</body>
</html>`;
}

interface Props {
  artifact: SandboxArtifact;
  minHeight?: number;
}

export default function SandboxFrame({ artifact, minHeight = 540 }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const doc = useMemo(() => buildDocument(artifact), [artifact]);

  useEffect(() => {
    setLoaded(false);
    setError(null);
    setHeight(minHeight);
  }, [doc, minHeight]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "sandbox:height" && typeof data.height === "number") {
        const next = Math.max(320, Math.min(3600, data.height));
        setHeight(next);
        return;
      }
      if (data.type === "sandbox:error" && typeof data.message === "string") {
        setError(data.message.slice(0, 400));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const reload = () => {
    setLoaded(false);
    setError(null);
    setHeight(minHeight);
    setReloadKey((value) => value + 1);
  };

  return (
    <div className="sandbox">
      <div className="sandbox-bar">
        <div className="sandbox-id">
          <span className="sandbox-dot" aria-hidden="true" />
          <span>
            {artifact.kind === "mindmap" ? "MINDMAP" : "INTERACTIVE"} · IFRAME
            CÔ LẬP
          </span>
        </div>
        <div className="sandbox-tools">
          <span className="sandbox-secure">
            <ShieldCheck size={13} /> NO NETWORK · NO PARENT DOM
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={reload}
            title="Tải lại sandbox"
            aria-label="Tải lại sandbox"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="sandbox-error">
          <CircleAlert size={15} />
          <span>{error}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setError(null)}
            aria-label="Đóng cảnh báo"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="sandbox-stage" style={{ minHeight }}>
        {!loaded && (
          <div className="sandbox-loading">
            <span className="sandbox-loader" aria-hidden="true" />
            <span>ĐANG KHỞI TẠO SANDBOX</span>
          </div>
        )}
        <iframe
          key={reloadKey}
          ref={frameRef}
          className="sandbox-iframe"
          title={artifact.title}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={doc}
          style={{ height }}
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}
