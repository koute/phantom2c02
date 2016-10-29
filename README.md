# What is this?

[Visual2C02](http://www.qmtpro.com/~nes/chipimages/visual2c02/) wrapped in a convenient API
to allow easy and fully automated simulation through [PhantomJS](http://phantomjs.org/).

# Usage

`phantomjs example01.js`

# API reference

### Toplevel

##### `create()` -> `Context`
<hr>

##### `ppumask( [value] )` -> `{...}`
<hr>

### Context

##### `.step_pixel()`
<hr>

##### `.step_scanline()`
<hr>

##### `.reset()`
<hr>

##### `.read_oam( offset )` -> `u8`
<hr>

##### `.write_oam( offset, value )`
<hr>

##### `.read_secondary_oam( offset )` -> `u8`
<hr>

##### `.write_secondary_oam( offset, value )`
<hr>

##### `.read_palette_ram( offset )` -> `u8`
<hr>

##### `.write_palette_ram( offset, value )`
<hr>

##### `.read_vram( address )` -> `u8`
<hr>

##### `.write_vram( address, value )`
<hr>

##### `.read_bits( node_name )` -> `Number`
<hr>

##### `.dump_oam()` -> `[256]`
<hr>

##### `.dump_secondary_oam()` -> `[32]`
<hr>

##### `.dump_palette_ram()` -> `[32]`
<hr>

##### `.dump_vram()` -> `[16384]`
<hr>

##### `.get_scanline()` -> `Number`
<hr>

##### `.get_dot()` -> `Number`
<hr>

##### `.get_address_bus()` -> `u16`
<hr>

##### `.get_data_bus()` -> `u8`
<hr>

##### `.get_current_address()` -> `u16`
<hr>

##### `.is_reading_from_vram()` -> `bool`
<hr>

##### `.is_writing_to_vram()` -> `bool`
<hr>

##### `.queue_cpu_read( address, [callback] )`
<hr>

##### `.queue_cpu_write( address, value )`
<hr>

##### `.exit()`
<hr>

##### `.screenshot( filename )`
<hr>
