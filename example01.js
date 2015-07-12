"use strict";

var phantom2c02 = require("./phantom2c02");
var sprintf = require("./lib/sprintf").sprintf;
var ppumask = phantom2c02.ppumask;

function repeat( times, callback ) {
    for( var i = 0; i < times; ++i ) {
        callback();
    }
}

phantom2c02.create( function( ctx ) {
    ctx.queue_cpu_write( ppumask().set_show_background( true ).set_show_sprites( true ) );
    ctx.queue_cpu_read( ppumask );

    ctx.step_scanline();

    // This will print every VRAM access the PPU does during scanline #0
    repeat( 255, function() {
        console.log( sprintf( "%03i %03i: %02X", ctx.get_scanline(), ctx.get_dot(), ctx.get_address_bus() ) );
        ctx.step_pixel();
    });

    ctx.exit();
});
