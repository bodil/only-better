/*global Reveal:true, window:true, document:true, setTimeout:true,
  ace:true, console:true, socket, io */

(function() {

  var comments = {
    java: "//",
    javascript: "//",
    ocaml: ["(*", "*)"],
    haskell: "--",
    clojure: ";;"
  };

  var socket = io.connect(window.location.origin + "/repl");

  var commentify = function(comment, prefix, msg) {
    return msg.split("\n").map(function(s) {
      if (typeof comment === "string")
        return s.length ? comment + prefix + " " + s : "";
      else
        return s.length ? comment[0] + prefix + " " + s + " " + comment[1] : "";
    }).join("\n");
  };

  var decommentify = function(language, s) {
    var comment = comments[language];
    return s.split("\n").filter(function(s) {
      var c = (typeof comment === "string") ? comment : comment[0];
      return s.slice(0, c.length) !== c;
    }).join("\n");
  };

  var flashEditor = function(editor, type) {
    editor.container.classList.add("flash-" + type);
    setTimeout(function() {
      editor.container.classList.remove("flash-" + type);
    }, 50);
  };

  var splitBuffer = function(buffer) {
    return buffer.split(/\n\n+/).map(function(s) { return s.trimRight() + "\n"; })
      .filter(function(s) { return s.trim().length > 0; });
  };

  var loading = function(language, exprs) {
    return exprs.concat([""]).join(commentify(comments[language], "...", "evaluating") + "\n\n");
  };

  var cancelEvaluation = function(editor) {
    editor.container.classList.remove("evaluating");
  };

  var evalBuffer = function(editor) {
    var code = splitBuffer(decommentify(editor.codeLanguage, editor.getValue())),
        pos = editor.selection.getCursor();
    editor.setValue(loading(editor.codeLanguage, code), 1);
    editor.selection.moveCursorToPosition(pos);
    editor.container.classList.add("evaluating");
    socket.emit("eval", {
      language: editor.codeLanguage,
      context: splitBuffer(editor.codeContext),
      code: code
    }, function(e) {
      var out = "";
      e.result.code.forEach(function(code, i) {
        var result = e.result.codeResults[i];
        out += code;
        if (result.error) {
          out += commentify(comments[editor.codeLanguage], "!!", result.error) + "\n";
        } else {
          out += (result.value ? commentify(comments[editor.codeLanguage], "=>", result.value) : "") + "\n";
        }
      });

      editor.container.classList.remove("evaluating");
      editor.setValue(out, 1);
      editor.selection.moveCursorToPosition(pos);

      flashEditor(editor, "success");
    });
  };

  var createEditor = function(el, lang) {
    var editor = ace.edit(el);
    editor.codeLanguage = lang;
    editor.setTheme("ace/theme/xcode");
    editor.renderer.setShowGutter(false);
    editor.session.setMode("ace/mode/" + lang);
    editor.session.setNewLineMode("unix");
    editor.session.setTabSize(2);
    editor.session.setUseSoftTabs(true);
    editor.session.setUseWrapMode(true);
    editor.session.setUseWorker(false);
    editor.setDisplayIndentGuides(false);

    editor.commands.addCommand({
      name: "cancelEvaluation",
      bindKey: "Ctrl-G",
      exec: function() { cancelEvaluation(editor); }
    });

    editor.commands.addCommand({
      name: "evalBuffer",
      bindKey: "Ctrl-S",
      exec: function() { evalBuffer(editor); }
    });

    editor.commands.addCommand({
      name: "removeToLineEnd",
      bindKey: "Ctrl-K",
      exec: function() { editor.removeToLineEnd(); }
    });

    editor.commands.addCommand({
      name: "startOfLine",
      bindKey: "Ctrl-A",
      exec: function() { editor.selection.moveCursorLineStart(); }
    });

    editor.commands.addCommand({
      name: "endOfLine",
      bindKey: "Ctrl-E",
      exec: function() { editor.selection.moveCursorLineEnd(); }
    });

    // editor.commands.addCommand({
    //   name: "forLoop",
    //   bindKey: "Ctrl-F",
    //   exec: function() { editor.insert("for (i = 0; i < list.length; i++) {}");
    //               editor.selection.moveCursorLeft(); }
    // });

    return editor;
  };

  var minIndent = function(text) {
    return text.split("\n").reduce(function(min, line) {
      if (line.trim().length === 0) return min;
      var indent = line.length - line.trimLeft().length;
      return min === null ? indent : Math.min(min, indent);
    }, null);
  };

  var alignIndents = function(text) {
    var indent = minIndent(text);
    return text.split("\n").map(function(line) {
      return line.slice(indent).trimRight();
    }).join("\n");
  };

  var cleanText = function(text) {
    text = alignIndents(text);
    while (text[0] === "\n") text = text.slice(1);
    while (text[text.length-1] === "\n") text = text.slice(0, text.length - 1);
    return text + "\n";
  };

  var installRepl = function(pre, context) {
    pre.classList.add("active");

    var lang = pre.dataset.lang;

    var repl = pre.repl = document.createElement("div");
    repl.classList.add("live-repl");
    repl.innerHTML = pre.innerHTML;
    pre.parentNode.appendChild(repl);
    window.editor = pre.editor = createEditor(repl, lang);
    pre.editor.codeContext = context;
    pre.editor.focus();
  };

  var uninstallRepl = function(pre) {
    window.editor = null;
    pre.editor.destroy();
    pre.editor = null;
    pre.parentNode.removeChild(pre.repl);
    pre.repl = null;
    pre.classList.remove("active");
  };

  var findRepl = function(slide) {
    return slide.querySelector("pre.repl");
  };

  var findContext = function(slide) {
    var pre = slide.querySelector("pre.context");
    return pre ? pre.innerHTML : "";
  };

  var forEach = function(seq, fn) {
    var i = 0, l = seq.length;
    for (; i < l; i++) {
      fn(seq[i]);
    }
  };

  (function() {
    var css = document.createElement("link");
    css.setAttribute("rel", "stylesheet");
    css.setAttribute("href", "plugin/repl/repl.css");
    document.head.appendChild(css);

    forEach(document.querySelectorAll("pre.repl"), function(pre) {
      pre.innerHTML = cleanText(pre.innerHTML);
    });

    document.addEventListener("keydown", function(e) {
      if (e.altKey && e.keyCode == 33) {
        Reveal.navigatePrev();
        e.preventDefault();
      } else if (e.altKey && e.keyCode == 34) {
        Reveal.navigateNext();
        e.preventDefault();
      }
    }, false);

    var currentRepl = findRepl(Reveal.getCurrentSlide());
    if (currentRepl)
      installRepl(currentRepl, findContext(Reveal.getCurrentSlide()));

    var replTimer = null;

    Reveal.addEventListener("slidechanged", function(event) {
      var currentRepl = findRepl(event.currentSlide),
          previousRepl = findRepl(event.previousSlide);
      if (previousRepl) uninstallRepl(previousRepl);
      if (currentRepl) {
        if (replTimer !== null) window.clearTimeout(replTimer);
        replTimer = setTimeout(function() {
          replTimer = null;
          installRepl(currentRepl, findContext(Reveal.getCurrentSlide()));
        }, 1000);
      }
    });
  })();
})();
