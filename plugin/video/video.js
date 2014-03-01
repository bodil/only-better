/*global Reveal */

(function() {

  function stopVideo(v) {
    console.log("stopVideo")
    v.pause();
    v.currentTime = 0;
  }

  Reveal.addEventListener("fragmentshown", function(event) {
    var v = Reveal.getCurrentSlide().querySelector("video");
    if (v) {
      if (v && event.fragment.classList.contains("video-play")) {
        v.play();
      } else {
        stopVideo(v);
      }
    }
  });

  Reveal.addEventListener("fragmenthidden", function(event) {
    var v = Reveal.getCurrentSlide().querySelector("video");
    if (v) {
      if (v && event.fragment.classList.contains("video-play")) {
        stopVideo(v);
      }
    }
  });

  Reveal.addEventListener("slidechanged", function(event) {
    var vc = event.currentSlide.querySelector("video"),
        vp = event.previousSlide.querySelector("video");
    if (vc) stopVideo(vc);
    if (vp) stopVideo(vp);
  });

})();
