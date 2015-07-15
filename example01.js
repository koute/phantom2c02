"use strict";

var phantom2c02 = require("./phantom2c02");
var sprintf = require("./lib/sprintf").sprintf;
var ppumask = phantom2c02.ppumask;

phantom2c02.create( function( ctx ) {
    ctx.queue_cpu_write( ppumask().set_show_background( true ).set_show_sprites( true ) );
    ctx.step_scanline();

    // This will print every VRAM access the PPU does during scanline #0
    ctx.repeat( 255, function() {
        if( ctx.is_reading_from_vram() ) {
            console.log( sprintf( "%s: 0x%04X 0x%02X", ctx.get_position(), ctx.get_address_bus(), ctx.get_data_bus() ) );
        }
        ctx.step_pixel();
    });

    ctx.exit();
});
