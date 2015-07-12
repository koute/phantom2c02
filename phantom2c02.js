"use strict";

var _ = require( "./lib/lodash" );

function create( callback ) {
    var page = require( "webpage" ).create();
    page.viewportSize = {
        width: 1280,
        height: 720
    };

    var last_callback_id = 0;
    var callbacks = {};

    var self = {
        exit: function() {
            phantom.exit();
        },

        step_pixel: function() {
            page.evaluate( function() {
                goPixel();
            });
        },

        step_scanline: function() {
            page.evaluate( function() {
                goScanline();
            })
        },

        reset: function() {
            page.evaluate( function() {
                resetChip();
            });
        },

        screenshot: function( filename ) {
            page.evaluate( function() {
                for( var addr = 0; addr <= 0x23ff; ++addr ) {
                    original_vram_setCellValue( addr, memory[ addr ] );
                }
                cmd_setupTable();
                original_cmd_highlightCurrent();
                original_chipStatus();
                original_stepDone();
            });
            page.render( filename );
        },

        read_oam: function( offset ) {
            if( offset > 0xFF || offset < 0 ) {
                throw new Error( "Offset out of range: " + offset );
            }
            return page.evaluate( function( offset ) {
                return sprite_read( offset );
            }, offset );
        },

        write_oam: function( offset, value ) {
            if( offset > 0xFF || offset < 0 ) {
                throw new Error( "Offset out of range: " + offset );
            }
            if( _.isUndefined( value ) ) {
                throw new Error( "Value is undefined" );
            }
            return page.evaluate( function( offset, value ) {
                sprite_write( offset, value );
            }, offset, value );
        },

        read_secondary_oam: function( offset ) {
            if( offset > 32 || offset < 0 ) {
                throw new Error( "Offset out of range: " + offset );
            }
            return page.evaluate( function( offset ) {
                return sprite_read( 0x100 + offset );
            }, offset );
        },

        write_secondary_oam: function( offset, value ) {
            if( offset > 32 || offset < 0 ) {
                throw new Error( "Offset out of range: " + offset );
            }
            if( _.isUndefined( value ) ) {
                throw new Error( "Value is undefined" );
            }
            return page.evaluate( function( offset, value ) {
                sprite_write( 0x100 + offset, value );
            }, offset, value );
        },

        read_palette_ram: function( offset ) {
            if( offset > 32 || offset < 0 ) {
                throw new Error( "Offset out of range: " + offset );
            }
            return page.evaluate( function( offset ) {
                return palette_read( offset );
            }, offset );
        },

        write_palette_ram: function( offset, value ) {
            if( offset > 32 || offset < 0 ) {
                throw new Error( "Offset out of range: " + offset );
            }
            if( _.isUndefined( value ) ) {
                throw new Error( "Value is undefined" );
            }
            return page.evaluate( function( offset, value ) {
                palette_write( offset, value );
            }, offset, value );
        },

        read_vram: function( offset ) {
            return page.evaluate( function( address ) {
                return mRead( address );
            }, address );
        },

        write_vram: function( address, value ) {
            return page.evaluate( function( address, value ) {
                mWrite( address, value );
            }, address, value );
        },

        dump_oam: function() {
            return page.evaluate( function( offset, value ) {
                var output = new Array( 256 );
                for( var i = 0; i < 256; ++i ) {
                    output[ i ] = sprite_read( i );
                }

                return output;
            });
        },

        dump_secondary_oam: function() {
            return page.evaluate( function( offset, value ) {
                var output = new Array( 32 );
                for( var i = 0; i < 32; ++i ) {
                    output[ i ] = sprite_read( 0x100 + i );
                }

                return output;
            });
        },

        dump_palette_ram: function() {
            return page.evaluate( function( offset, value ) {
                var output = new Array( 32 );
                for( var i = 0; i < 32; ++i ) {
                    output[ i ] = palette_read( i );
                }

                return output;
            });
        },

        dump_vram: function() {
            return page.evaluate( function( offset, value ) {
                var output = new Array( 0x4000 );
                for( var i = 0; i < 0x4000; ++i ) {
                    output[ i ] = mRead( i );
                }

                return output;
            });
        },

        get_scanline: function() {
            return page.evaluate( function() {
                return readBits( "vpos", 9 );
            });
        },

        get_dot: function() {
            return page.evaluate( function() {
                return readBits( "hpos", 9 );
            });
        },

        get_address_bus: function() {
            return page.evaluate( function() {
                return readAddressBus();
            });
        },

        queue_cpu_read: function( address, callback ) {
            if( address === ppumask ) {
                address = ppumask();
            }

            if( _.isObject( address ) && !_.isUndefined( address.address ) ) {
                address = address.address;
            }

            if( address < 0x2000 || address > 0x3FFF ) {
                throw new Error( "Address out of range: " + address );
            }
            address = address & (8 - 1);

            var callback_id = null;
            if( !_.isUndefined( callback ) ) {
                callback_id = ++last_callback_id;
                callbacks[ callback_id ] = callback;
            }

            return page.evaluate( function( address, callback_id ) {
                var entry = (address << 8) | 0x3000;
                queue_cpu_action( entry, callback_id );
            }, address, callback_id );
        },

        queue_cpu_write: function( address, value ) {
            if( address === ppumask ) {
                address = ppumask();
            }

            if( _.isObject( address ) && !_.isUndefined( address.address ) && !_.isUndefined( address.value ) ) {
                value = address.value;
                address = address.address;
            }

            if( address < 0x2000 || address > 0x3FFF ) {
                throw new Error( "Address out of range: " + address );
            }

            address = address & (8 - 1);

            if( _.isObject( value ) && value.value ) {
                value = value;
            }

            if( value < 0 || value > 0xFF ) {
                throw new Error( "Value out of range: " + value );
            }

            return page.evaluate( function( address, value ) {
                var entry = value | (address << 8) | 0x2000;
                queue_cpu_action( entry );
            }, address, value );
        }
    };

    page.onConsoleMessage = function( message ) {
        console.log( message );
    };

    page.onCallback = function( data ) {
        callbacks[ data.callback_id ]( data.value );
        delete callbacks[ data.callback_id ];
    };

    var initialize = function() {
        page.evaluate( function() {
            updateChipLayoutAnimation( false );
            updateChipLayoutVisibility( false );
            updateVideo = function() {};
            updateLogbox = function() {};
            original_chipStatus = chipStatus;
            chipStatus = function() {};
            document.getElementById( "tracingdiv" ).style.display = "none";

            original_stepDone = stepDone;
            stepDone = function() {};

            original_vram_setCellValue = vram_setCellValue;
            vram_setCellValue = function() {};

            original_cmd_highlightCurrent = cmd_highlightCurrent;
            cmd_highlightCurrent = function() {};

            original_cmd_setCellValue = cmd_setCellValue;
            cmd_setCellValue = function( which, value ) {
                which = ((which - 5) / 8);
                var callback_id = callback_ids[ which ];
                if( callback_id !== null ) {
                    window.callPhantom( { callback_id: callback_id, value: value } );
                }
            };

            callback_ids = {};
            testprogram = [0];
            ioParms = 0;

            queue_cpu_action = function( entry, callback_id ) {
                if( testprogram[ testprogram.length - 1 ] === 0 ) {
                    testprogram.pop();
                }
                if( testprogramAddress >= testprogram.length ) {
                    testprogramAddress = testprogram.length;
                }
                callback_ids[ testprogramAddress ] = callback_id;
                testprogram.push( entry );
                testprogram.push( 0 );
            };
        });
    };

    page.open( "visual2c02/index.html", function( status ) {
        if( status !== "success" ) {
            console.log( "INTERNAL ERROR: Page load failed!" );
            phantom.exit();
        }

        page.evaluate( function() {
            // This is called in initChip() which screws up our queued CPU read/writes.
            proper_handleIoBus = handleIoBus;
            handleIoBus = function() {
                handleIoBus = proper_handleIoBus;
            }

            chipLayoutIsVisible = false;
        });

        var wait = function() {
            var status = page.evaluate( function() {
                return document.getElementById('status').innerText;
            });

            if( _.startsWith( status, "halfcyc:" ) ) {
                initialize();
                callback( self );
            } else {
                setTimeout( wait, 25 );
            }
        }

        setTimeout( wait, 25 );
    });
}

function accessor( obj, bit, key ) {
    obj[ key ] = function() {
        return obj.value & (1 << bit);
    };

    obj[ "set_" + key ] = function( value ) {
        obj.value = (obj.value & (~(1 << bit))) | ((value & 1) << bit);
        return obj;
    };
}

function ppumask( value ) {
    var obj = { address: 0x2001, value: value };
    accessor( obj, 0, "greyscale" );
    accessor( obj, 1, "show_background_in_leftmost_8_pixels" );
    accessor( obj, 2, "show_sprites_in_leftmost_8_pixels" );
    accessor( obj, 3, "show_background" );
    accessor( obj, 4, "show_sprites" );
    accessor( obj, 5, "emphasize_red" );
    accessor( obj, 6, "emphasize_green" );
    accessor( obj, 7, "emphasize_blue" );

    return obj;
}

module.exports.create = create;
module.exports.ppumask = ppumask;
