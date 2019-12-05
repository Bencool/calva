import { ReplReadline, CompletionListener } from "./readline";
import * as paredit from "../cursor-doc/paredit";
import { getIndent } from "../cursor-doc/indent";
import { HotKeyTable } from "./hotkeys";
import { ModelEdit, emptySelectionOption } from "../cursor-doc/model";

const defaultHotkeys = new HotKeyTable<ReplConsole>({
    // "Backspace": "backspace",
    // "Delete": "delete",
    // "Alt+Backspace": "force-backspace",
    // "Alt+Delete": "force-delete",

    "Cmd+A": "select-all",
    "Cmd+Z": "undo",
    "Cmd+Shift+Z": "redo",
    "LeftArrow": "cursor-left",
    "Shift+LeftArrow": "cursor-select-left",
    "RightArrow": "cursor-right",
    "Shift+RightArrow": "cursor-select-right",
    //"UpArrow": "cursor-up",
    "Shift+UpArrow": "cursor-select-up",
    //"DownArrow": "cursor-down",
    "Shift+DownArrow": "cursor-select-down",
    "Home": "cursor-home",
    "Shift+Home": "cursor-select-home",
    //"Ctrl+Home": "cursor-home-all", TODO: Figure out how to bind this right
    //"Shift+Home": "cursor-select-home", TODO: Figure out how to bind this right
    "End": "cursor-end",
    "Shift+End": "cursor-select-end",
    //"Ctrl+End": "cursor-end-all", TODO: Figure out how to bind this right
    //"Shift+End": "cursor-select-end", TODO: Figure out how to bind this right
    //"Alt+UpArrow": "history-up",
    //"Alt+DownArrow": "history-down",
    //"Alt+Return": "submit",
    "Ctrl+L": "clear-window"
})


export enum ReplPareditKeyMap {
    NONE,
    ORIGINAL,
    STRICT
}



export class ReplConsole {
    readline: ReplReadline;
    input: HTMLInputElement;
    hotkeys: HotKeyTable<ReplConsole>;
    pareditKeyMap: ReplPareditKeyMap = ReplPareditKeyMap.ORIGINAL;

    historyIndex = -1;
    history: string[] = [];

    /** Event listeners for history */
    private _historyListeners: ((line: string) => void)[] = [];

    private isElementInViewport(el) {
        var rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /*or $(window).height() */
            rect.right <= (window.innerWidth || document.documentElement.clientWidth) /*or $(window).width() */
        );
    }

    private ensureCaretInView() {
        const el = this.readline.caret;
        if (!this.isElementInViewport(el)) {
            el.scrollIntoView({ block: "nearest" });
        }
    }

    private isKeyMap(values: ReplPareditKeyMap[]): boolean {

        if (this.pareditKeyMap == ReplPareditKeyMap.NONE) {
            return false;
        }
        if (values.includes(this.pareditKeyMap)) {
            return true;
        }
        return false;
    }

    getPareditKeyMap(): ReplPareditKeyMap {
        return this.pareditKeyMap;
    }

    setPareditKeyMap(value: String) {
        switch (value.trim().toLowerCase()) {
            case 'original':
                this.pareditKeyMap = ReplPareditKeyMap.ORIGINAL;
                break;
            case 'strict':
                this.pareditKeyMap = ReplPareditKeyMap.STRICT;
                break;
            default:
                this.pareditKeyMap = ReplPareditKeyMap.NONE;
        }
    }

    addHistoryListener(c: (line: string) => void) {
        if (this._historyListeners.indexOf(c) == -1)
            this._historyListeners.push(c);
    }

    removeHistoryListener(c: (line: string) => void) {
        let idx = this._historyListeners.indexOf(c);
        if (idx != -1)
            this._historyListeners.splice(idx, 1);
    }

    /** Event listeners for completion */
    private _completionListeners: CompletionListener[] = [];

    addCompletionListener(c: CompletionListener) {
        if (this._completionListeners.indexOf(c) == -1)
            this._completionListeners.push(c);
    }

    removeCompletionListener(c: CompletionListener) {
        let idx = this._completionListeners.indexOf(c);
        if (idx != -1)
            this._completionListeners.splice(idx, 1);
    }

    constructor(public elem: HTMLElement, public onReadLine: (x: string, pprint: boolean) => void = () => { }) {
        this.hotkeys = defaultHotkeys;
        this.input = document.createElement("input");
        this.input.style.width = "0px";
        this.input.style.height = "0px";
        this.input.style.position = "fixed";
        this.input.style.opacity = "0";

        this.input.addEventListener("focus", () => {
            this.readline.mainElem.classList.add("is-focused")
        })

        this.input.addEventListener("blur", () => {
            this.readline.clearCompletion();
            this.readline.mainElem.classList.remove("is-focused")
        })

        document.addEventListener("cut", e => {
            if (document.activeElement == this.input) {
                e.clipboardData.setData("text/plain", this.readline.model.getText(this.readline.selectionStart, this.readline.selectionEnd));
                this.readline.delete();
                e.preventDefault();
                this.ensureCaretInView();
            }
        })

        document.addEventListener("copy", e => {
            if (document.activeElement == this.input) {
                e.clipboardData.setData("text/plain", this.readline.model.getText(this.readline.selectionStart, this.readline.selectionEnd));
                e.preventDefault();
            }
        })

        document.addEventListener("paste", e => {
            if (document.activeElement == this.input) {
                this.readline.clearCompletion();
                this.readline.model.undoManager.insertUndoStop()
                this.readline.insertString(e.clipboardData.getData("text/plain"));
                e.preventDefault();
                this.ensureCaretInView();
            }
        })

        this.input.addEventListener("keydown", e => {
            if (this.hotkeys.execute(this, e)) {
                e.preventDefault();
                this.ensureCaretInView();
                return;
            }
            if (e.key.length == 1 && !e.metaKey && !e.ctrlKey) {
                if (e.key == " ")
                    this.readline.model.undoManager.insertUndoStop();
            } else {
                switch (e.keyCode) {
                    case 9: // Tab
                        e.preventDefault();
                        break;
                    // case 13:
                    //     if (this.readline.canReturn()) {
                    //         this.submitLine();
                    //         this.readline.clearCompletion();
                    //         window.scrollTo({ left: 0 });
                    //     } else {
                    //         this.readline.model.undoManager.insertUndoStop();
                    //         let indent = getIndent(this.readline.model, this.readline.selectionEnd);
                    //         let istr = ""
                    //         for (let i = 0; i < indent; i++)
                    //             istr += " "
                    //         this.readline.insertString("\n" + istr);
                    //     }
                    //     break;
                }
            }
        }, { capture: true })

        this.input.addEventListener("input", e => {
            this.readline.mainElem.scrollIntoView({ block: "end" })

            if (this.input.value == '"') {
                this.readline.withUndo(() => {
                    paredit.stringQuote(this.readline)
                    this.readline.repaint()
                })
                this.readline.clearCompletion();
                e.preventDefault();
            } else if (this.input.value == "(") {
                this.readline.withUndo(() => {
                    paredit.open(this.readline, "(", ")");
                    this.readline.repaint();
                })
                this.readline.clearCompletion();
                e.preventDefault();
            } else if (this.input.value == "[") {
                this.readline.withUndo(() => {
                    paredit.open(this.readline, "[", "]");
                    this.readline.repaint();
                })
                this.readline.clearCompletion();
                e.preventDefault();
            } else if (this.input.value == "{") {
                this.readline.withUndo(() => {
                    paredit.open(this.readline, "{", "}");
                    this.readline.repaint();
                })
                this.readline.clearCompletion();
                e.preventDefault();
            } else if (this.input.value == "{") {
                this.readline.withUndo(() => {
                    paredit.open(this.readline, "{", "}");
                    this.readline.repaint();
                })
                this.readline.clearCompletion();
                e.preventDefault();
            } else if (this.input.value == ")") {
                this.readline.withUndo(() => {
                    paredit.close(this.readline, ")");
                    this.readline.repaint();
                })
                this.readline.clearCompletion();
                e.preventDefault();
            } else if (this.input.value == "]") {
                this.readline.withUndo(() => {
                    paredit.close(this.readline, "]");
                    this.readline.repaint();
                })
                this.readline.clearCompletion();
                e.preventDefault();
            } else if (this.input.value == "}") {
                this.readline.withUndo(() => {
                    paredit.close(this.readline, "}");
                    this.readline.repaint();
                })
                this.readline.clearCompletion();
                e.preventDefault();
            } else if (this.input.value == "\n") {
                if (this.readline.canReturn()) {
                    this.submitLine();
                    this.readline.mainElem.scrollIntoView({ block: "end" });
                } else {
                    this.readline.model.undoManager.insertUndoStop();
                    let indent = getIndent(this.readline.model, this.readline.selectionEnd);
                    let istr = ""
                    for (let i = 0; i < indent; i++)
                        istr += " "
                    this.readline.insertString("\n" + istr);
                    this.readline.clearCompletion();
                }
            } else {
                this.readline.insertString(this.input.value)
                this.readline.maybeShowCompletion();
            }
            this.input.value = ""
            e.preventDefault();
            this.ensureCaretInView();
        })
    }

    printElement(element: HTMLElement) {
        if (!this.readline || this.input.disabled) {
            this.elem.appendChild(element);
            element.scrollIntoView({ block: "end" });
        } else {
            this.elem.insertBefore(element, this.readline.elem);
            this.readline.elem.scrollIntoView({ block: "end" });
        }
    }

    printElementBeforeReadline(element: HTMLElement) {
        if (!this.readline) {
            this.elem.appendChild(element);
            element.scrollIntoView({ block: "nearest" });
        } else {
            this.elem.insertBefore(element, this.readline.elem);
            this.readline.elem.scrollIntoView({ block: "nearest" });
        }
    }

    print(text: string) {
        let el = document.createElement("div");
        el.textContent = text;
        el.className = "output";
        this.printElement(el);
    }

    setText(text: string) {
        this.readline.model.edit([
            new ModelEdit('changeRange', [0, this.readline.model.maxOffset, text])
        ], {});
        this.readline.repaint();
    }

    setHistory(history: string[]) {
        this.history = history;
        this.historyIndex = -1;
    }

    submitLine(trigger = true, pprint = false) {
        let line = this.readline.model.getText(0, this.readline.model.maxOffset);
        if (line.trim() == "") {
            this.readline.freeze();
            this.requestPrompt(this.readline.promptElem.textContent);
            return;
        }
        let last = "";
        if (this.history.length > 0) {
            last = this.history[this.history.length - 1];
        }
        if (last != line.trim()) {
            this.history.push(line.trim());
            this._historyListeners.forEach(x => x(line));
        }
        this.historyIndex = -1;
        this.readline.freeze();
        if (trigger)
            this.onReadLine(line, pprint);
    }

    requestPrompt(prompt: string) {
        if (this.readline && !this.input.disabled)
            return;
        this.readline = new ReplReadline(this.elem, prompt, this.input);
        this.readline.addCompletionListener(e => this._completionListeners.forEach(listener => listener(e)));
        this.elem.appendChild(this.input);
        this.input.disabled = false;
        this.input.focus();
        this.readline.mainElem.scrollIntoView({ block: "end" })
    }

    onRepaint = () => { };

    commands = {
        "raise-sexp": () => {
            this.readline.withUndo(() => {
                paredit.raiseSexp(this.readline);
                this.readline.repaint();
            });

        },
        "transpose-sexps": () => {
            console.warn("Transpose is disabled in the REPL window, because: https://github.com/BetterThanTomorrow/calva/issues/490");
            // this.readline.withUndo(() => {
            //     paredit.transpose(this.readline);
            //     this.readline.repaint();
            // });
        },
        "push-sexp-left": () => {
            console.warn("Push sexp left is disabled in the REPL window, because: https://github.com/BetterThanTomorrow/calva/issues/490");
            // this.readline.withUndo(() => {
            //     paredit.pushSexprLeft(this.readline);
            //     this.readline.repaint();
            // });
        },
        "push-sexp-right": () => {
            console.warn("Push sexp right is disabled in the REPL window, because: https://github.com/BetterThanTomorrow/calva/issues/490");
            // this.readline.withUndo(() => {
            //     paredit.pushSexprRight(this.readline);
            //     this.readline.repaint();
            // });
        },
        "convolute-sexp": () => {
            console.warn("Convolute is disabled in the REPL window, because: https://github.com/BetterThanTomorrow/calva/issues/490");
            // this.readline.withUndo(() => {
            //     paredit.convolute(this.readline);
            //     this.readline.repaint();
            // });
        },
        "grow-selection": () => {
            this.readline.withUndo(() => {
                paredit.growSelection(this.readline)
                this.readline.repaint();
            })
        },
        "shrink-selection": () => {
            this.readline.withUndo(() => {
                paredit.shrinkSelection(this.readline)
                this.readline.repaint();
            })
        },
        "backward-sexp": () => {
            paredit.moveToRangeStart(this.readline, paredit.rangeToBackwardSexp(this.readline));
            this.readline.repaint();
        },
        "forward-sexp": () => {
            paredit.moveToRangeEnd(this.readline, paredit.rangeToForwardSexp(this.readline));
            this.readline.repaint();
        },
        "down-list": () => {
            paredit.moveToRangeEnd(this.readline, paredit.rangeToForwardDownList(this.readline));
            this.readline.repaint();
        },
        "up-list": () => {
            paredit.moveToRangeEnd(this.readline, paredit.rangeToForwardUpList(this.readline));
            this.readline.repaint();
        },
        "backward-up-list": () => {
            paredit.moveToRangeStart(this.readline, paredit.rangeToBackwardUpList(this.readline));
            this.readline.repaint();
        },
        "backward-down-list": () => {
            paredit.moveToRangeStart(this.readline, paredit.rangeToBackwardDownList(this.readline));
            this.readline.repaint();
        },
        "close-list": () => {
            paredit.moveToRangeEnd(this.readline, paredit.rangeToForwardList(this.readline));
            this.readline.repaint();
        },
        "open-list": () => {
            paredit.moveToRangeStart(this.readline, paredit.rangeToBackwardList(this.readline));
            this.readline.repaint();
        },
        "select-defun": () => {
            paredit.selectRange(this.readline, paredit.rangeForDefun(this.readline));
            this.readline.repaint();
        },
        "select-forward-sexp": () => {
            paredit.selectRangeFromSelectionStart(this.readline, paredit.rangeToForwardSexp(this.readline, this.readline.selectionEnd));
            this.readline.repaint();
        },
        "select-backward-sexp": () => {
            paredit.selectRangeFromSelectionEnd(this.readline, paredit.rangeToBackwardSexp(this.readline, this.readline.selectionEnd));
            this.readline.repaint();
        },
        "select-forward-down-sexp": () => {
            paredit.selectRangeFromSelectionStart(this.readline, paredit.rangeToForwardDownList(this.readline, this.readline.selectionEnd));
            this.readline.repaint();
        },
        "select-backward-down-sexp": () => {
            paredit.selectRangeFromSelectionEnd(this.readline, paredit.rangeToBackwardDownList(this.readline, this.readline.selectionEnd));
            this.readline.repaint();
        },
        "select-forward-up-sexp": () => {
            paredit.selectRangeFromSelectionStart(this.readline, paredit.rangeToForwardUpList(this.readline, this.readline.selectionEnd));
            this.readline.repaint();
        },
        "select-backward-up-sexp": () => {
            paredit.selectRangeFromSelectionEnd(this.readline, paredit.rangeToBackwardUpList(this.readline, this.readline.selectionEnd));
            this.readline.repaint();
        },
        "select-close-list": () => {
            paredit.selectRangeFromSelectionStart(this.readline, paredit.rangeToForwardList(this.readline, this.readline.selectionEnd));
            this.readline.repaint();
        },
        "select-open-list": () => {
            paredit.selectRangeFromSelectionEnd(this.readline, paredit.rangeToBackwardList(this.readline, this.readline.selectionEnd));
            this.readline.repaint();
        },
        "kill-forward-sexp": () => {
            this.readline.withUndo(() => {
                paredit.killRange(this.readline, paredit.rangeToForwardSexp(this.readline));
                this.readline.repaint();
            })
        },
        "kill-backward-sexp": () => {
            this.readline.withUndo(() => {
                paredit.killRange(this.readline, paredit.rangeToBackwardSexp(this.readline));
                this.readline.repaint();
            })
        },
        "kill-close-list": () => {
            this.readline.withUndo(() => {
                paredit.killForwardList(this.readline);
                this.readline.repaint();
            })
        },
        "kill-open-list": () => {
            this.readline.withUndo(() => {
                paredit.killBackwardList(this.readline);
                this.readline.repaint();
            })
        },
        "select-all": () => {
            this.readline.selectionStart = 0;
            this.readline.selectionEnd = this.readline.model.maxOffset;
            this.readline.repaint();
        },
        "undo": () => {
            this.readline.model.undoManager.undo(this.readline)
            this.readline.repaint();
        },
        "redo": () => {
            this.readline.model.undoManager.redo(this.readline)
            this.readline.repaint();
        },
        "join-sexp": () => {
            this.readline.withUndo(() => {
                paredit.joinSexp(this.readline);
                this.readline.repaint();
            })
        },
        "backward-slurp-sexp": () => {
            this.readline.withUndo(() => {
                paredit.backwardSlurpSexp(this.readline);
                this.readline.repaint();
            })
        },
        "forward-barf-sexp": () => {
            this.readline.withUndo(() => {
                paredit.forwardBarfSexp(this.readline);
                this.readline.repaint();
            })
        },
        "cursor-left": () => {
            this.readline.caretLeft(true);
            this.readline.repaint();
        },
        "cursor-select-left": () => {
            this.readline.caretLeft(false);
            this.readline.repaint();
        },
        "forward-slurp-sexp": () => {
            this.readline.withUndo(() => {
                paredit.forwardSlurpSexp(this.readline);
                this.readline.repaint();
            })
        },
        "backward-barf-sexp": () => {
            this.readline.withUndo(() => {
                paredit.backwardBarfSexp(this.readline);
                this.readline.repaint();
            })
        },
        "cursor-right": () => {
            this.readline.caretRight(true)
            this.readline.repaint();
        },
        "cursor-select-right": () => {
            this.readline.caretRight(false)
            this.readline.repaint();
        },
        "splice-sexp-killing-backwards": () => {
            this.readline.withUndo(() => {
                paredit.killBackwardList(this.readline);
                paredit.spliceSexp(this.readline);
                this.readline.repaint();
            });
        },
        "cursor-up": () => {
            this.readline.caretUp(true);
            this.readline.repaint();
        },
        "cursor-select-up": () => {
            this.readline.caretUp(false);
            this.readline.repaint();
        },
        "splice-sexp-killing-forwards": () => {
            this.readline.withUndo(() => {
                paredit.killForwardList(this.readline);
                paredit.spliceSexp(this.readline);
                this.readline.repaint();
            });
        },
        "cursor-down": () => {
            this.readline.caretDown(true);
            this.readline.repaint();
        },
        "cursor-select-down": () => {
            this.readline.caretDown(false);
            this.readline.repaint();
        },
        "backspace": () => {
            this.readline.withUndo(() => {
                paredit.backspace(this.readline);
                this.readline.repaint()
            })
        },
        "force-backspace": () => {
            this.readline.withUndo(() => {
                this.readline.backspace();
                this.readline.repaint()
            })
        },
        "delete": () => {
            this.readline.withUndo(() => {
                paredit.deleteForward(this.readline);
                this.readline.repaint()
            })
        },
        "force-delete": () => {
            this.readline.withUndo(() => {
                this.readline.delete();
                this.readline.repaint();
            });
        },
        "cursor-home": () => {
            this.readline.caretHome(true);
            this.readline.repaint();
        },
        "cursor-select-home": () => {
            this.readline.caretHome(false);
            this.readline.repaint();
        },
        "cursor-home-all": () => {
            this.readline.caretHomeAll(true);
            this.readline.repaint();
        },
        "cursor-select-home-all": () => {
            this.readline.caretHomeAll(false);
            this.readline.repaint();
        },
        "cursor-end": () => {
            this.readline.caretEnd(true);
            this.readline.repaint();
        },
        "cursor-select-end": () => {
            this.readline.caretEnd(false);
            this.readline.repaint();
        },
        "cursor-end-all": () => {
            this.readline.caretEndAll(true);
            this.readline.repaint();
        },
        "cursor-select-end-all": () => {
            this.readline.caretEndAll(false);
            this.readline.repaint();
        },
        "wrap-round": () => {
            this.readline.withUndo(() => {
                paredit.wrapSexpr(this.readline, "(", ")");
                this.readline.repaint();
            })
        },
        "wrap-square": () => {
            this.readline.withUndo(() => {
                paredit.wrapSexpr(this.readline, "[", "]");
                this.readline.repaint();
            })
        },
        "wrap-curly": () => {
            this.readline.withUndo(() => {
                paredit.wrapSexpr(this.readline, "{", "}");
                this.readline.repaint();
            })
        },
        "wrap-quote": () => {
            this.readline.withUndo(() => {
                paredit.wrapSexpr(this.readline, '"', '"');
                this.readline.repaint();
            })
        },
        "rewrap-round": () => {
            this.readline.withUndo(() => {
                paredit.rewrapSexpr(this.readline, "(", ")");
                this.readline.repaint();
            })
        },
        "rewrap-square": () => {
            this.readline.withUndo(() => {
                paredit.rewrapSexpr(this.readline, "[", "]");
                this.readline.repaint();
            })
        },
        "rewrap-curly": () => {
            this.readline.withUndo(() => {
                paredit.rewrapSexpr(this.readline, "{", "}");
                this.readline.repaint();
            })
        },
        "rewrap-quote": () => {
            this.readline.withUndo(() => {
                paredit.rewrapSexpr(this.readline, '"', '"');
                this.readline.repaint();
            })
        },
        "split-sexp": () => {
            this.readline.withUndo(() => {
                paredit.splitSexp(this.readline);
                this.readline.repaint();
            })
        },
        "splice-sexp": () => {
            this.readline.withUndo(() => {
                paredit.spliceSexp(this.readline);
                this.readline.repaint();
            })
        },
        "history-up": () => {
            if (this.historyIndex == 0)
                return;
            if (this.historyIndex == -1)
                this.historyIndex = this.history.length;
            this.historyIndex--;
            let line = this.history[this.historyIndex] || "";
            this.readline.withUndo(() => {
                this.readline.model.edit([
                    new ModelEdit('changeRange', [0, this.readline.model.maxOffset, line])
                ], { selection: emptySelectionOption(line.length) });
            })
            this.readline.repaint();
        },
        "history-down": () => {
            if (this.historyIndex == this.history.length || this.historyIndex == -1)
                return;
            this.historyIndex++;
            let line = this.history[this.historyIndex] || "";
            this.readline.withUndo(() => {
                this.readline.model.edit([
                    new ModelEdit('changeRange', [0, this.readline.model.maxOffset, line])
                ], { selection: emptySelectionOption(line.length) });
            })
            this.readline.repaint();
        },
        "new-line": () => {
            if (this.readline.canReturn()) {
                this.submitLine();
                this.readline.clearCompletion();
                window.scrollTo({ left: 0 });
            } else {
                this.readline.model.undoManager.insertUndoStop();
                let indent = getIndent(this.readline.model, this.readline.selectionEnd);
                let istr = ""
                for (let i = 0; i < indent; i++)
                    istr += " "
                this.readline.insertString("\n" + istr);
            }
        },
        "submit": () => {
            this.submitLine(true, false)
            this.readline.clearCompletion();
        },
        "clear-window": () => {
            // TODO: How to add undo to this?
            const prompt = this.readline.promptElem.textContent;
            const replElement = window.document.getElementById('repl');
            replElement.textContent = "";
            this.readline = null;
            this.requestPrompt(prompt);
        }
    }
}