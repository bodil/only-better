(function() {

  var describeFunction = function(fn) {
    var sig = fn.toString(), i = sig.indexOf("{");
    return sig.slice(0, i);
  };

  var flashEditor = function(editor, type) {
    editor.container.classList.add("flash-" + type);
    setTimeout(function() {
      editor.container.classList.remove("flash-" + type);
    }, 50);
  };

  var evaluateExpAtPoint = function(editor) {
    var ast, code, exprs, val, out = "", pos = 0, errors = false;
    code = editor.getValue().replace(/^\/\/.*(\n|$)/gm, "");
    try {
      ast = esprima.parse(code, {range: true, tolerant: true});
    } catch (e) {
      code = code.split("\n");
      out = code.slice(0, e.lineNumber)
        .concat("//!! " + e.description)
        .concat(code.slice(e.lineNumber));
      editor.setValue(out.join("\n"), 1);
      editor.selection.moveCursorTo(e.lineNumber - 1, e.column);
      flashEditor(editor, "error");
      return;
    }
    exprs = ast.body;
    exprs.forEach(function(expr) {
      while (code[expr.range[1] - 1] === "\n") expr.range[1]--;
      expr.src = code.slice(expr.range[0], expr.range[1]);
    });

    (function(__exprs) {
      var __i = 0, __l = __exprs.length;
      for (; __i < __l; __i++) {
        try {
          __exprs[__i].result = eval(__exprs[__i].src);
        } catch (e) {
          console.log(e);
          __exprs[__i].error = e.name + ": " + e.message;
        }
      }
    })(exprs);

    exprs.forEach(function(expr) {
      out += code.slice(pos, expr.range[1]);
      pos = expr.range[1];
      if (expr.error !== undefined) {
        out += "\n//=> " + expr.error;
        errors = true;
      } else if (expr.result !== undefined) {
        val = typeof expr.result === "function" ? describeFunction(expr.result)
          : JSON.stringify(expr.result);
        console.log(val);
        out += "\n//=> " + val.split("\n").join("\n//=> ");
      }
    });

    flashEditor(editor, errors ? "error" : "success");

    pos = editor.selection.getCursor();
    editor.setValue(out + "\n", 1);
    editor.selection.moveCursorToPosition(pos);
  };

  var createEditor = function(el) {
    var editor = ace.edit(el);
    editor.setTheme("ace/theme/dawn");
    editor.renderer.setShowGutter(false);
    editor.session.setMode("ace/mode/javascript");
    editor.session.setNewLineMode("unix");
    editor.session.setTabSize(2);
    editor.session.setUseSoftTabs(true);
    editor.setDisplayIndentGuides(false);

    editor.commands.addCommand({
      name: "evaluateExpAtPoint",
      bindKey: "Ctrl-S",
      exec: function() { evaluateExpAtPoint(editor); }
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

    return editor;
  };

  var minIndent = function(text) {
    var lines = text.split("\n");
    return text.split("\n").reduce(function(min, line) {
      if (line.trim().length === 0) return min;
      var indent = line.length - line.trimLeft().length;
      return min === null ? indent : Math.min(min, indent);
    }, null);
  };

  var alignIndents = function(text) {
    var indent = minIndent(text);
    return text.split("\n").map(function(line) {
      return line.slice(indent);
    }).join("\n");
  };

  var cleanText = function(text) {
    text = alignIndents(text);
    while (text[0] === "\n") text = text.slice(1);
    while (text[text.length-1] === "\n") text = text.slice(0, text.length - 1);
    return text + "\n";
  };

  var installRepl = function(pre) {
    pre.classList.add("active");

    var repl = pre.repl = document.createElement("div");
    repl.classList.add("live-repl");
    repl.innerHTML = pre.innerHTML;
    pre.parentNode.appendChild(repl);
    window.editor = pre.editor = createEditor(repl);
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

    var currentRepl = findRepl(Reveal.getCurrentSlide());
    if (currentRepl) installRepl(currentRepl);

    var replTimer = null;

    Reveal.addEventListener("slidechanged", function(event) {
      var currentRepl = findRepl(event.currentSlide),
          previousRepl = findRepl(event.previousSlide);
      if (previousRepl) uninstallRepl(previousRepl);
      if (currentRepl) {
        if (replTimer !== null) window.clearTimeout(replTimer);
        replTimer = setTimeout(function() {
          replTimer = null;
          installRepl(currentRepl);
        }, 1000);
      }
    });
  })();
})();
