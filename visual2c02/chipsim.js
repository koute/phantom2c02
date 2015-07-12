/*
 Copyright (c) 2010 Brian Silverman, Barry Silverman

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

var ctrace = false;
var traceTheseNodes = [];
var traceTheseTransistors = [];
var loglevel = 0;
var recalclist = new Array();
var recalcHash = new Array();
var group = new Array();

function recalcNodeList(list){
	var n = list[0];
	recalclist = new Array();
	recalcHash = new Array();
	for(var j=0;j<100;j++){		// loop limiter
		if (j == 99) console.log('Encountered loop!');
		if(list.length==0) return;
		if(ctrace) {
			var i;
			for(i=0;i<traceTheseNodes.length;i++) {
				if(list.indexOf(traceTheseNodes[i])!=-1) break;
			}
			if((traceTheseNodes.length==0)||(list.indexOf(traceTheseNodes[i])==-1)) {
				console.log('recalcNodeList iteration: ', j, ' ', list.length, ' nodes');
			} else {
				console.log('recalcNodeList iteration: ', j, ' ', list.length, ' nodes ', list);
			}
		}
		list.forEach(recalcNode);
		list = recalclist;
		recalclist = new Array();
		recalcHash = new Array();
	}
	if(ctrace) console.log(n,' looping...');
}

function recalcNode(node){
	if(node==ngnd) return;
	if(node==npwr) return;
	getNodeGroup(node);
	var newState = getNodeValue();
	if(ctrace){
		var i;
		for(i=0;i<group.length;i++) {
			if(traceTheseNodes.indexOf(group[i])!=-1) break;
		}
		if ((traceTheseNodes.indexOf(node)!=-1) || (i != group.length))
			console.log('recalc ', node, ' ', group, ' to ', newState);
	}
	group.forEach(function(i){
		if (i==npwr || i==ngnd) return;
		var n = nodes[i];
		if(n.state==newState) return;
		n.state = newState;
		n.gates.forEach(function(t){
			if(n.state) turnTransistorOn(t);
			else turnTransistorOff(t);});
	});
}

function turnTransistorOn(t){
	if(t.on) return;
	if(ctrace && ((traceTheseTransistors.indexOf(t.name)!=-1) || (traceTheseNodes.indexOf(t.c1)!=-1) || (traceTheseNodes.indexOf(t.c2)!=-1)))
		console.log(t.name, ' on ', t.gate, ' ', t.c1, ' ', t.c2);
	t.on = true;
	addRecalcNode(t.c1);
}

function turnTransistorOff(t){
	if(!t.on) return;
	if(ctrace && ((traceTheseTransistors.indexOf(t.name)!=-1) || (traceTheseNodes.indexOf(t.c1)!=-1) || (traceTheseNodes.indexOf(t.c2)!=-1)))
		console.log(t.name, ' off ', t.gate, ' ', t.c1, ' ', t.c2);
	t.on = false;
	addRecalcNode(t.c1);
	addRecalcNode(t.c2);
}

function addRecalcNode(nn, pos){
	if(nn==ngnd) return;
	if(nn==npwr) return;
	if(recalcHash[nn] == 1)return;
	recalclist.push(nn);
	recalcHash[nn] = 1;
}

function getNodeGroup(i){
	group = new Array();
	addNodeToGroup(i);
}

function addNodeToGroup(i){
	if(group.indexOf(i) != -1) return;
	group.push(i);
	if(i==ngnd) return;
	if(i==npwr) return;
	nodes[i].c1c2s.forEach(
		function(t){
			if(!t.on) return;
			var other;
			if(t.c1==i) other=t.c2;
			if(t.c2==i) other=t.c1;
			addNodeToGroup(other);});
}


function getNodeValue(){
	var gnd = arrayContains(group, ngnd);
	var pwr = arrayContains(group, npwr);
	if (pwr && gnd) {
		if (arrayContains(group, 359) ||
			arrayContains(group, 566) ||
			arrayContains(group, 691) ||
			arrayContains(group, 871) ||
			arrayContains(group, 870) ||
			arrayContains(group, 864) ||
			arrayContains(group, 856) ||
			arrayContains(group, 818))
			gnd = pwr = false;
	}
	if (gnd) return false;
	if (pwr) return true;
	var hi_area = 0;
	var lo_area = 0;
	for(var i in group){
		var nn = group[i];
		if (nn == ngnd || nn == npwr) continue;
		var n = nodes[nn];
		if(n.pullup) return true;
		if(n.pulldown) return false;
		if(n.state) hi_area += n.area;
		else lo_area += n.area;
	}
//	return (hi_area > 0);
	return (hi_area > lo_area);
}


function isNodeHigh(nn){
	return(nodes[nn].state);
}

function saveString(name, str){
	var request = new XMLHttpRequest();
	request.onreadystatechange=function(){};
	request.open('PUT', 'save.php?name='+name, true);
	request.setRequestHeader('Content-Type', 'text/plain');
	request.send(str);
}

function allNodes(){
	var res = new Array();
	for(var i in nodes) if((i!=npwr)&&(i!=ngnd)) res.push(i);
	return res;
}

function getState(){
	var codes = ['l','h'];
	var res = '';
	for(var i=0;i<nodes.length;i++){
		var n = nodes[i];
		if(n==undefined) res+='x';
		else if(i==ngnd) res+='g';
		else if(i==npwr) res+='v';
		else res+= codes[0+n.state];
	}
	return res;
}

function setState(str){
	var codes = {g: false, h: true, v: true, l: false};
	for(var i=0;i<str.length;i++){
		if(str[i]=='x') continue;
		var state = codes[str[i]];
		if (nodes[i] == undefined) continue;
		nodes[i].state = state;
		var gates = nodes[i].gates;
		gates.forEach(function(t){t.on=state;});
	}
	refresh();
}


function setFloat(name){
	var nn = nodenames[name];
	nodes[nn].pullup = false;
	nodes[nn].pulldown = false;
	recalcNodeList([nn]);
}

function setHigh(name){
	var nn = nodenames[name];
	nodes[nn].pullup = true;
	nodes[nn].pulldown = false;
	recalcNodeList([nn]);
}

function setLow(name){
	var nn = nodenames[name];
	nodes[nn].pullup = false;
	nodes[nn].pulldown = true;
	recalcNodeList([nn]);
}

function arrayContains(arr, el){return arr.indexOf(el)!=-1;}
