// PUBLIC: the embed script. Paste on any website:
//   <script src="https://<HolmOS address>/embed/form.js" data-form="<form id>" async></script>
//   <script src="https://<HolmOS address>/embed/form.js" data-booking="<booking page address>" async></script>
// It adds an iframe right where the script tag is and keeps it the right height.

const SCRIPT = String.raw`(function () {
  var scripts = document.querySelectorAll("script[data-form], script[data-booking]");
  var origin = null;
  for (var i = 0; i < scripts.length; i++) {
    var script = scripts[i];
    if (script.getAttribute("data-holmos-done")) continue;
    if (!/\/embed\/form\.js(\?|$)/.test(script.src)) continue;
    script.setAttribute("data-holmos-done", "1");
    origin = new URL(script.src).origin;
    var form = script.getAttribute("data-form");
    var booking = script.getAttribute("data-booking");
    var params = new URLSearchParams({ source: location.href });
    var accent = script.getAttribute("data-accent");
    if (accent) params.set("accent", accent);
    var src = form
      ? origin + "/embed/form/" + encodeURIComponent(form) + "?" + params
      : origin + "/book/" + encodeURIComponent(booking) + "?embed=1";
    var frame = document.createElement("iframe");
    frame.src = src;
    frame.title = script.getAttribute("data-title") || (form ? "Form" : "Booking");
    frame.setAttribute("scrolling", "no");
    frame.style.cssText = "display:block;width:100%;border:0;overflow:hidden;background:transparent;height:" + (form ? 420 : 640) + "px";
    script.parentNode.insertBefore(frame, script);
  }
  if (!origin || window.__holmosEmbed) return;
  window.__holmosEmbed = true;
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || typeof data.type !== "string" || data.type.indexOf("holmos:") !== 0) return;
    var frames = document.querySelectorAll("iframe");
    for (var j = 0; j < frames.length; j++) {
      if (frames[j].contentWindow !== event.source) continue;
      if (new URL(frames[j].src).origin !== event.origin) return;
      if (data.type === "holmos:height" && data.height > 0) frames[j].style.height = Math.ceil(data.height) + "px";
      if (data.type === "holmos:redirect" && /^https?:\/\//.test(data.url)) window.location.href = data.url;
    }
  });
})();
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
