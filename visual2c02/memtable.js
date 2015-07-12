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

var vram_table;
var vram_selected;

function vram_setupTable(){
	vram_table = document.getElementById('vram_table');
	for(var r = vram_table.rows.length; r > 0; r--)
		vram_table.deleteRow(r-1);
	for(var r=0;r<0x80;r++){
		var row = document.createElement('tr');
		vram_table.appendChild(row);
		var col = document.createElement('td');
		var addr = r;
		if (r >= 0x40) addr += 0x1C0;
		col.appendChild(document.createTextNode(hexWord(addr*16)+':'));
		col.onmousedown = vram_unselectCell;
		row.appendChild(col);
		for(var c=0;c<16;c++){
			col = document.createElement('td');
			col.addr = addr*16+c;
			col.val = mRead(col.addr);
			col.onmousedown = function(e){vram_handleCellClick(e);};
			col.appendChild(document.createTextNode(hexByte(col.val)));
			row.appendChild(col);
		}
	}
}

function vram_handleCellClick(e){
	var c = e.target;
	vram_selectCell(c.addr);
}

function vram_cellKeydown(e){
	var c = e.keyCode;
	var next;
	if (vram_selected == 0x3FF) next = 0x2000;
	else if (vram_selected == 0x23FF) next = 0;
	else next = vram_selected + 1;
	var prev;
	if (vram_selected == 0) prev = 0x23FF;
	else if (vram_selected == 0x2000) prev = 0x3FF;
	else prev = vram_selected - 1;
	if(c==13) vram_unselectCell();
	else if(c==32) vram_selectCell(next);
	else if(c==8) vram_selectCell(prev);
	else if((c>=48)&&(c<58)) vram_setCellValue(vram_selected, vram_getCellValue(vram_selected)*16+c-48);
	else if((c>=65)&&(c<71)) vram_setCellValue(vram_selected, vram_getCellValue(vram_selected)*16+c-55);
	mWrite(vram_selected, vram_getCellValue(vram_selected));
}

function vram_setCellValue(n, val){
	if(val==undefined)
		val=0x00;
	val%=256;
	vram_cellEl(n).val=val;
	vram_cellEl(n).innerHTML=hexByte(val);
}

function vram_getCellValue(n){return vram_cellEl(n).val;}

function vram_selectCell(n){
	vram_unselectCell();
	if (n >= 0x4000) return;
	n &= 0x23FF;
	vram_cellEl(n).style.background = '#ff8';
	vram_selected = n;
	vram_table.onkeydown = function(e){vram_cellKeydown(e);};
}

function vram_unselectCell(){
	if(vram_selected==undefined) return;
	vram_cellEl(vram_selected).style.background = '#fff';
	vram_selected = undefined;
	window.onkeydown = undefined;
}

function vram_cellEl(n){
	var r = n>>4;
	var c = n%16;
	while (r & 0x1C0) r -= 0x040;
	if (r & 0x200) r -= 0x1C0;
	var e = vram_table.childNodes[r].childNodes[c+1];
	return e;
}

var cmd_table;
var cmd_selected;
//var testprogramAddress;
var cmd_modes=["-","-","W","R"];

function cmd_setupTable(){
	cmd_table = document.getElementById('cmd_table');
	for(var r = cmd_table.rows.length; r > 0; r--)
		cmd_table.deleteRow(r-1);
	for(var r=0;r<testprogram.length;r++){
		var row = document.createElement('tr');
		cmd_table.appendChild(row);
		cmd_insertRow(row,r);
	}
}

function cmd_insertRow(row,r)
{
	var col;

	col = document.createElement('td');
	col.addr = (r*8)+0;
	col.onmousedown = function(e){cmd_delete(e);};
	col.appendChild(document.createTextNode('-'));
	row.appendChild(col);

	col = document.createElement('td');
	col.addr = (r*8)+1;
	col.onmousedown = function(e){cmd_setAddress(e);};
	col.appendChild(document.createTextNode('*'));
	row.appendChild(col);

	col = document.createElement('td');
	col.addr = (r*8)+2;
	col.onmousedown = function(e){cmd_insert(e);};
	col.appendChild(document.createTextNode('+'));
	row.appendChild(col);

	col = document.createElement('td');
	col.addr = (r*8)+3;
	col.val = (testprogram[r] >> 12) & 0x3;
	col.onmousedown = function(e){cmd_select(e);};
	col.appendChild(document.createTextNode(cmd_modes[col.val]));
	row.appendChild(col);

	col = document.createElement('td');
	col.addr = (r*8)+4;
	col.val = (testprogram[r] >> 8) & 0x7;
	col.onmousedown = function(e){cmd_select(e);};
	col.appendChild(document.createTextNode(col.val));
	row.appendChild(col);

	col = document.createElement('td');
	col.addr = (r*8)+5;
	col.val = (testprogram[r] & 0xFF);
	col.onmousedown = function(e){cmd_select(e);};
	col.appendChild(document.createTextNode(hexByte(col.val)));
	row.appendChild(col);
}

function cmd_insert(e){
	var n = e.target.addr;
	var r = n>>3;
	testprogram.splice(r+1,0,0x0018);
        var row = document.createElement('tr');
        cmd_table.insertBefore(row,e.target.parentNode.nextSibling);
	cmd_insertRow(row,r+1);
	if (testprogramAddress > r) testprogramAddress++;
	if (cmd_selected>>3 > r) cmd_selected += 8;
	for (var cr = 0; cr < testprogram.length; cr++)
	{
		cmd_cellEl(cr*8+0).addr = cr*8+0;
		cmd_cellEl(cr*8+1).addr = cr*8+1;
		cmd_cellEl(cr*8+2).addr = cr*8+2;
		cmd_cellEl(cr*8+3).addr = cr*8+3;
		cmd_cellEl(cr*8+4).addr = cr*8+4;
		cmd_cellEl(cr*8+5).addr = cr*8+5;
	}
	cmd_highlightCurrent();
}

function cmd_delete(e){
	if (testprogram.length == 1) return;
	var n = e.target.addr;
	var r = n>>3;
	testprogram.splice(r,1);
	var row = e.target.parentNode;
	row.parentNode.removeChild(row);
	if (testprogramAddress > r) testprogramAddress--;
	if (cmd_selected>>3 > r) cmd_selected -= 8;
	for (var cr = 0; cr < testprogram.length; cr++)
	{
		cmd_cellEl(cr*8+0).addr = cr*8+0;
		cmd_cellEl(cr*8+1).addr = cr*8+1;
		cmd_cellEl(cr*8+2).addr = cr*8+2;
		cmd_cellEl(cr*8+3).addr = cr*8+3;
		cmd_cellEl(cr*8+4).addr = cr*8+4;
		cmd_cellEl(cr*8+5).addr = cr*8+5;
	}
	cmd_highlightCurrent();
}

function cmd_highlightCurrent()
{
	for(var r=0;r<testprogram.length;r++){
		if (r == testprogramAddress)
			cmd_cellEl((r*8)+1).style.background = '#ff8';
		else	cmd_cellEl((r*8)+1).style.background = '#fff';
	}
}

function cmd_setAddress(e){
	var n = e.target.addr;
	var r = n>>3;
	testprogramAddress = r;
	ioCounter = 0;
	cmd_highlightCurrent();
}

function cmd_select(e){
	cmd_selectCell(e.target.addr);
}

function cmd_selectCell(n){
	cmd_unselectCell();
	var r = n>>3;
	if(r > testprogram.length) return;
	cmd_cellEl(n).style.background = '#ff8';
	cmd_selected = n;
	cmd_table.onkeydown = function(e){cmd_cellKeydown(e);};
}

function cmd_unselectCell(){
	if(cmd_selected==undefined) return;
	var c = cmd_cellEl(cmd_selected);
	if (c) c.style.background = '#fff';
	cmd_selected = undefined;
	window.onkeydown = undefined;
}

function cmd_cellKeydown(e){
	var k = e.keyCode;
	var r = cmd_selected>>3;
	var pr = (r + testprogram.length - 1) % testprogram.length;
	var nr = (r + 1) % testprogram.length;
	var c = cmd_selected%8;
	if(k==13) cmd_unselectCell();
	else if(k==32) {
		if (c == 5)
			cmd_selectCell(nr*8+3);
		else	cmd_selectCell(cmd_selected+1);
	}
	else if(k==8) {
		if (c == 3)
			cmd_selectCell(pr*8+5);
		else	cmd_selectCell(cmd_selected-1);
	}
	else {
		if (c == 3)
		{
			if (k==82) cmd_setCellValue(cmd_selected, 3);
			else if (k==87) cmd_setCellValue(cmd_selected, 2);
			else if (k==109) cmd_setCellValue(cmd_selected, 0);
		}
		else if (c == 4)
		{
			if((k>=48)&&(k<58)) cmd_setCellValue(cmd_selected, k-48);
			else if((k>=65)&&(k<71)) cmd_setCellValue(cmd_selected, k-55);
		}
		else if (c == 5)
		{
			if((k>=48)&&(k<58)) cmd_setCellValue(cmd_selected, cmd_getCellValue(cmd_selected)*16+k-48);
			else if((k>=65)&&(k<71)) cmd_setCellValue(cmd_selected, cmd_getCellValue(cmd_selected)*16+k-55);
		}
	}
}

function cmd_setCellValue(n, val){
	if(val==undefined)
		val=0x00;
	var r = n>>3;
	var c = n%8;

	if (c == 3) {
		val%=4;
		cmd_cellEl(n).val=val;
		cmd_cellEl(n).innerHTML=cmd_modes[val];
		testprogram[r] = (testprogram[r] & 0x0FFF) | (val << 12);
	}
	else if (c == 4) {
		val%=8;
		cmd_cellEl(n).val=val;
		cmd_cellEl(n).innerHTML=val;
		testprogram[r] = (testprogram[r] & 0xF0FF) | (val << 8);
	}
	else if (c == 5) {
		val%=256;
		cmd_cellEl(n).val=val;
		cmd_cellEl(n).innerHTML=hexByte(val);
		testprogram[r] = (testprogram[r] & 0xFF00) | (val);
	}
}

function cmd_getCellValue(n){return cmd_cellEl(n).val;}

function cmd_cellEl(n){
	var r = n>>3;
	var c = n%8;
	var e = cmd_table.childNodes[r];
	if (e) e = e.childNodes[c];
	return e;
}

