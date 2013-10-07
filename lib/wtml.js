var wtml = function() {

    var Lexer = (function () { //break down the string into elements
        return function () {
            this.process = function (wtmlRaw) {
                var elements = [];

                var cleanedRawInput = preProcess(wtmlRaw);
                var matches;
                while (matches = finalRegex.exec(cleanedRawInput)) {

                    var element = {};
                    if (typeof matches[8] === 'string') {
                        element.type = 'nestingGrammar';
                        element.value = matches[8];
                    }
                    if (typeof matches[2] === 'string') {
                        element.type = 'selector';
                        element.value = matches[2];

                        element.selector = {};
                        element.selector.tag = matches[3];

                        if (typeof matches[3] !== 'undefined') { //id
                            //throw an error, tag missing
                        }

                        if (typeof matches[4] !== 'undefined') { //id
                            element.selector.id = matches[4].substr(1);
                        }
                        if (typeof matches[5] !== 'undefined' && matches[5] !== "") { //class
                            element.selector.class = matches[5].substr(1).split('.');
                        }
                        if (typeof matches[6] !== 'undefined' && matches[6] !== "") { //attr
                            element.selector.attr = matches[6].slice(1, -1).split(/\].*\[/);
                        }
                        if (typeof matches[7] !== 'undefined') { //content
                            element.selector.content = matches[7].slice(1, -1); //strip off the braces
                        }
                    }
                    if (typeof matches[1] === 'string') {
                        element.type = 'htmlComment';
                        element.value = matches[1];
                    }

                    if (typeof element.type === 'undefined') {
                        //throw error
                    }

                    element.rawMatches = matches;

                    elements.push(element);
                }

                console.log('elements: ', elements);

                elements.push(cleanedRawInput);

                return elements;
            };

            var preProcess = function (wtmlRaw) {
                var commentMatch = /\/\/.*?(?=\n)|\/\*([^*]|[\r\n])*\*\//g; //matches all comments in c form
                var cleaned = wtmlRaw.replace(commentMatch, ''); //strip all comments
                return cleaned;
            };

            var htmlTag = /([a-zA-Z0-9]+)/,
                className = /((?:\.-?[_a-zA-Z]+[_a-zA-Z0-9-]*)*)/,
                id = /(#-?[_a-zA-Z]+[_a-zA-Z0-9-])?/,
                attribute = /((?:\[.*?\])*)/,
                content = /(\(.*?\))*/
                ;

            var selectorRegex = new RegExp(htmlTag.source + id.source + className.source + attribute.source + content.source, 'g');

            var htmlComment = /<!--.*?-->/,
                nestingGrammar = /[{>}]/
                ;

            var finalRegex = new RegExp('(' + htmlComment.source + ')|(' + selectorRegex.source + ')|(' + nestingGrammar.source + ')', 'g');
            ///(htmlComment)|($selectorRegex)|($nestingGrammar)/s";

            console.log(selectorRegex);
            console.log(finalRegex);
        };
    })();


    var Parser = (function () { //build up the syntax tree with the elements
        return function () {
            this.process = function (elements) {

                var domTree = {
                    children: [],
                    locate: function (locateKey) {
                        var retrieveObject = this;
                        var keyCopy = locateKey.slice(0);

                        while (keyCopy.length > 0) {
                            var key = keyCopy.shift();
//                                console.log('key', key);
//                                console.log('retrieveObject', retrieveObject);

                            if (typeof retrieveObject.children === 'undefined') {
                                retrieveObject.children = [];
                            }
                            if (typeof retrieveObject.children[key] === 'undefined') {
                                retrieveObject.children[key] = {};
                            }

                            retrieveObject = retrieveObject.children[key]; //drill down into object
                        }

                        return retrieveObject;
                    }
                };

                var domLocation = [-1];
                var nestedSelectorQueueCount = 0;
                for (var i = 0; i < elements.length; i++) {
                    var currentElement = elements[i];
                    if (currentElement.type === 'selector') {
                        domLocation[domLocation.length - 1]++; //go to next location
                        domTree.locate(domLocation).element = currentElement;

                        console.log('inserted', currentElement.value, 'at', domLocation);

                        console.log('elements[i+1]', elements[i + 1], typeof elements[i + 1]);

                        if (nestedSelectorQueueCount > 0 && typeof elements[i + 1] === 'object' && !( elements[i + 1].type === 'nestingGrammar' && elements[i + 1].value === '>')) {
                            console.log('nestedSelectorQueueCount', nestedSelectorQueueCount);
                            domLocation.splice(nestedSelectorQueueCount * -1, nestedSelectorQueueCount); //jump back up a level
                            nestedSelectorQueueCount = 0; //reset
                        }
                    }
                    if (currentElement.type === 'nestingGrammar') {
                        if (currentElement.value === '{') {
                            domLocation.push(-1); //jump down a level
                        } else if (currentElement.value === '}') {
                            domLocation.pop(); //jump back up a level
                        } else if (currentElement.value === '>') {
                            domLocation.push(-1);
                            console.log('domLocation', domLocation);
                            nestedSelectorQueueCount++;
                            //@todo do nothing for now, wait til I have a better visual on the dom tree manipulation
                        }
                    }

                }

                domTree.test = JSON.stringify(domTree.children, null, "\t");

                return domTree;
            };
        };
    })();

    var Compiler = (function () { //build up the html from the syntax tree
        return function () {

            var htmlElements = [];

            var compileSelector = function (selector, hasChildNodes) {

                var startString = '<';
                var htmlNode = {};


                startString += selector.tag;

                if (typeof selector.id !== 'undefined') {
                    startString += ' id="' + selector.id + '"';
                }

                if (typeof selector.class !== 'undefined') {
                    startString += ' class="' + selector.class.join(' ') + '"';
                }

                if (typeof selector.attr !== 'undefined') {
                    startString += ' ' + selector.attr.join(' ');
                }

                if (!hasChildNodes && typeof selector.content === 'undefined') { //no children node or content, self close
                    startString += '/>';
                } else {
                    startString += '>';
                    htmlNode.closeTag = '</' + selector.tag + '>';
                }

                if (typeof selector.content !== 'undefined') {
                    startString += selector.content;
                }

                htmlNode.openTag = startString;

                return htmlNode;
            };

            var previousNodeDepth = 0;
            var closingTagBuffer = [];
            var appendClosingTags = function (referenceDepth) {
                var depthDiff = previousNodeDepth - referenceDepth;

                if (depthDiff === 0 && typeof htmlElements[htmlElements.length - 1] !== 'undefined' && htmlElements[htmlElements.length - 1].hasClosingTag === false) {
                    return; //the prior sibling has no closing tag, don't try to close it
                }


                if (closingTagBuffer.length > 0 && depthDiff >= 0) {
                    var retrievedElements = closingTagBuffer.splice(0, depthDiff + 1);
                    console.log('retrievedElements', retrievedElements, 'depth diff was ', depthDiff);
                    htmlElements = htmlElements.concat(retrievedElements);
                }
            };
            var nodeReferenceId = 0;
            var processNode = function (node, hasChildNodes, currentDepth) {
                console.log(node);


                if (typeof node.element === 'undefined') {
                    return;
                }
                if (node.element.type === 'selector') {
                    var selector = compileSelector(node.element.selector, hasChildNodes);

                    htmlElements.push({
                        refId: nodeReferenceId,
                        content: selector.openTag,
                        depth: currentDepth,
                        hasClosingTag: (typeof selector.closeTag !== 'undefined')
                    });

                    if (typeof selector.closeTag !== 'undefined') {

                        closingTagBuffer.unshift({
                            refId: nodeReferenceId,
                            content: selector.closeTag,
                            depth: currentDepth,
                            hasClosingTag: null //it IS the closing tag!
                        });
                    }
                }

                nodeReferenceId++;

                console.log('this node value', node.element.value, 'at depth', currentDepth);
                previousNodeDepth = currentDepth;
            };

            var walkTree = function (node, currentDepth) {


                appendClosingTags(currentDepth);
                if (typeof node.children === 'undefined') {
                    processNode(node, false, currentDepth);
                    return; //end of tree reached
                } else {
                    processNode(node, true, currentDepth);
                }
                for (var i = 0; i < node.children.length; i++) {
                    if (typeof node.children[i] === 'undefined') {
                        continue;
                    }

                    walkTree(node.children[i], currentDepth + 1);
                }
            };


            var repeatString = function (pattern, count) {
                if (count < 1) {
                    return '';
                }
                var result = '';
                while (count > 0) {
                    if (count & 1) {
                        result += pattern;
                    }
                    count >>= 1;
                    pattern += pattern;
                }
                return result;
            };

            var formatHtml = function (htmlElements) {
                var prevReferenceId = -1; //init
                var htmlFormatted = [];
                for (var i = 0; i < htmlElements.length; i++) {
                    var thisElement = htmlElements[i];
                    var referenceId = thisElement.refId;

                    if (referenceId !== prevReferenceId) {
                        htmlFormatted.push(repeatString('\u00A0', thisElement.depth * 4) + thisElement.content);
                        htmlFormatted.push('\n');
                    } else {
                        htmlFormatted.pop(); //remove the last \n
                        htmlFormatted.push(thisElement.content + '\n');
                    }

                    prevReferenceId = referenceId; //for the next loop
                }
                return htmlFormatted.join('');
            };

            this.process = function (domTree) {
                var html = '';

                walkTree(domTree, 0);
                appendClosingTags(0); //final tag pop

                console.log(htmlElements);
                html = formatHtml(htmlElements); //this needs to be ooped better

                console.log(htmlElements);
                console.log(closingTagBuffer);
                console.log(html);

                return html;
            };
        };
    })();

    this.translate = function (inputWTML) {

        var lexer = new Lexer(),
            parser = new Parser(),
            compiler = new Compiler()
            ;

        if (typeof inputWTML !== 'string'){
            return '';
        }

        var elements = lexer.process(inputWTML),
            domTree = parser.process(elements)
            ;

//            console.log('elements', elements);
//            console.log('domTree', domTree);

        return compiler.process(domTree);
    };

    return this;
};


if (typeof exports !== "undefined") {
    module.exports = wtml;
}
