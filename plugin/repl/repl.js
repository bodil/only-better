/*global Reveal:true, window:true, document:true, setTimeout:true,
  ace:true, console:true, socket */

(function() {

  var socket = io.connect(window.location.origin + "/repl");

  var commentify = function(prefix, msg) {
    return msg.split("\n").map(function(s) {
      return "//" + prefix + " " + s;
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

  var evalBuffer = function(editor) {
    socket.emit("eval", {
      language: editor.codeLanguage,
      context: splitBuffer(editor.codeContext),
      code: splitBuffer(editor.getValue().replace(/^\/\/.*(\n|$)/gm, ""))
    }, function(res) {
      console.log(res);
    });
  };

  var evaluateExpAtPointOld = function(editor) {
    var compiled, exprs, val, out = "", pos = 0, errors = false,
        context = editor.jsContext || "",
        code = editor.getValue().replace(/^\/\/.*(\n|$)/gm, "");

    compiled = tsCompile(context + code);
    exprs = compiled.exprs;

    if (compiled.errors.length) {
      exprs.forEach(function(expr) {
        var end = expr.ast.limChar - offset;
        if (end < 0) {
          expr.errors.forEach(function(error) {
            var pos = posForOffset(context, error.start);
            console.error("In context: " + pos.row + ":" + pos.col +
                          ": " + error.msg);
          });
          return;
        }
        out += code.slice(pos, end);
        pos = end;
        if (expr.errors.length) {
          expr.errors.forEach(function(error) {
            out += "\n" + commentify("!!", error.msg);
          });
        }
      });
      editor.setValue(out, 1);
      pos = posForOffset(code, compiled.errors[0].start - offset);
      editor.gotoLine(pos.row, pos.col, true);
      flashEditor(editor, "error");
      return;
    }

    (function(__exprs) {
      var __i = 0, __l = __exprs.length;
      for (; __i < __l; __i++) {
        try {
          __exprs[__i].result = eval(__exprs[__i].src);
        } catch (e) {
          __exprs[__i].error = e.name + ": " + e.message;
        }
      }
    })(exprs);

    exprs.forEach(function(expr) {
      var end = expr.ast.limChar - offset;
      if (end < 0) return;
      while (code[end-1] === "\n" || code[end-1] === " ") end--;
      out += code.slice(pos, end);
      pos = end;
      if (expr.error !== undefined) {
        out += "\n//=> " + expr.error;
        errors = true;
      } else if (expr.result !== undefined) {
        val = stringify(expr.result);
        out += "\n" + commentify("=>", val);
      }
    });

    flashEditor(editor, errors ? "error" : "success");

    pos = editor.selection.getCursor();
    editor.setValue(out + "\n", 1);
    editor.selection.moveCursorToPosition(pos);
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
