
var Wire = (function (undefined) {
	'use strict'

	var Listeners = new Map();

	var Listener = function (element, dataObject, binding, parent) {
		var parts = binding.split(":", 2);
		this.element = element;
		this.dataObject = dataObject;
		this.bindingType = parts[0].trim().toLowerCase();
		this.objectPath = parts[1].trim();
		this.parent = parent;

		// store this in a master list and then add the key to the element
		// so the change handler can find it
		var key = '#' + getRandomInt(1000000);
		while (Listeners.has(key)) {
			key = '#' + getRandomInt(1000000);
		}
		Listeners.set(key, this);
		element.setAttribute("data-wwHash", key);

		if (this.bindingType == "value" || this.bindingType == "option" ) {
			element.onchange = this.onChange;
			//element.addEventListener("change", this.onChange, false);
		}

		// store all objects with the same binding in an array in a map
		if (!parent.mappings.has(this.objectPath)) {
			parent.mappings.set(this.objectPath, new Array());
		}
		parent.mappings.get(this.objectPath).push(this);
	};

	Listener.prototype.onChange = function (e) {
		var key = e.currentTarget.attributes["data-wwHash"].value;
		if (key) {
			var me = Listeners.get(key);
			if (me) {
				me.setValue(e.target.value);
				var subscribers = me.parent.mappings.get(me.objectPath);
				subscribers.forEach(function (item) {
					if (item !== me) {
						item.updateUI();
					}
				});
			}
		}
	}

	Listener.prototype.getValue = function () {
		var obj = this.dataObject;
		var objectPath = this.objectPath.split('.');
		while (objectPath.length) {
			obj = obj[objectPath.shift()];
		}
		return obj;
	};

	Listener.prototype.setValue = function (value) {
		var obj = this.dataObject;
		var objectPath = this.objectPath.split('.');
		while (objectPath.length > 1) {
			obj = obj[objectPath.shift()];
		}
		obj[objectPath[0]] = value;
	};

	Listener.prototype.updateUI = function () {
		var value = this.getValue();

		// update the ui
		switch (this.bindingType) {
			case "option":
				var radios = this.element.querySelectorAll("input[type='radio']");
				for (var i = 0; i < radios.length; i++) {
					var r = radios.item(i);
					r.checked = (r.value == value);
				}
				break;
			case "text":
				bindText(this.element, value);
				break;
			case "value":
				this.element.value = value;
				break;
			case "id":
				this.element.setAttribute('data-id', value);
				break;
			case "class":
				var name = this.objectPath.split('.');
				name = name[name.length - 1];

				if (value == undefined || value == null || value == "") {
					this.element.classList.remove(name);
				}
				else {
					this.element.classList.add(name);
				}
				break;
			case "array":
				bindArray(this.element, value, this);
				break;
			case "style":
				var name = this.objectPath.split('.');
				name = name[name.length - 1].toLowerCase();
				this.element.style[name] = value;
				break;
		}
	};

	function getRandomInt(max) {
		return Math.floor(Math.random() * Math.floor(max));
	}

	function bindText(element, data) {
		// insert a node if needed
		if (element.childNodes.length == 0) {
			// no current nodes make a new one and add it
			var n = document.createTextNode(data);
			element.appendChild(n);
		}
		else {
			// current nodes
			if (element.childNodes[0].nodeType === 3) {		// TEXT_NODE
				// current first node is text so just replace it
				element.childNodes[0].nodeValue = data;
			}
			else {
				// current first node is not text so insert before it
				var n = document.createTextNode(data);
				element.insertBefore(n, element.childNodes[0])
			}
		}
	}

	function bindArray(element, data, me) {
		if (!Array.isArray(data)) {
			console.error("The data passed in the bind to the " + element.tagName + " is not an array!");
		}
		else {
			if (element.childElementCount != 1) {
				console.error(element.tagName + " used in the array binding can only have one child element to be the template!");
			}
			else {
				// store what will be the template
				me.template = element.children[0];
				// clear the nodes - gets rid of text nodes too ;)
				while (element.firstChild) {
					element.removeChild(element.firstChild);
				}

				me.rows = new Map();
				data.forEach(function (item, index) {
					var tmp = me.template.cloneNode(true);
					element.appendChild(tmp);
					var p = {
						mappings: new Map(),
						arrayParent: me
					};
					var id = item.Id;
					if (!id) {
						id = index;
					}
					me.rows.set(id, p)
					bindDOMBranch(tmp, item, p);
				});
			}
		}
	}

	function bindDOMBranch(element, data, parentBinding) {
		var bindingAttr = element.attributes["data-bind"];
		var bindChildrenRequired = true;
		if (bindingAttr != undefined) {
			// do the binding(s) for this element and let the binding look for children
			bindingAttr.value.split(",").forEach(function (binding, index) {
				bindChildrenRequired &= bindElement(element, data, binding, parentBinding);
			});
		}
		if (bindChildrenRequired) {
			for (var i = 0; i < element.children.length; i++) {
				bindDOMBranch(element.children[i], data, parentBinding);
			};
		}
	}

	function bindElement(element, data, binding, parentBinding) {
		var l = new Listener(element, data, binding, parentBinding);
		l.updateUI();
		return (l.bindingType != "array");		// an array will have bound its children
	}

	function bindTop(element, viewModel) {
		var p = {
			mappings: new Map()
		};
		bindDOMBranch(element, viewModel, p);
	}

	function Unwrap() {
		Listeners.forEach(function (item, i) {
			item.element.removeEventListener("change", item.onChange);
			item.element.removeAttribute("data-wwHash");
		});
		Listeners.clear();
	}

	return {
		Wrap: bindTop,
		Unwrap
	};
}());
