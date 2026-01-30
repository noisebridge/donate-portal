use <font.scad>

// Set this to "black", "red", or "white" to render different modules
render_color = "black";

overlap = 0.001;
width = 61;
height = 106;
qr_size = 53;
qr_margin = (width - qr_size) / 2;
border_width = 1;
back_depth = 1;
qr_depth = 2;

module qr_code(data) {
    rows = len(data);
    cols = len(data[0]);

    for (y = [0:rows-1]) {
        for (x = [0:cols-1]) {
            if (data[y][x] == 1) {
                translate([x, -y, 0])
                    cube(1 + overlap);
            }
        }
    }
};

module black(qr_data, text_lines) {
    color([0.2, 0.2, 0.2])
    union() {
        translate([
            qr_margin,
            height - (qr_margin + 1),
            back_depth - overlap
        ])
            scale([1, 1, qr_depth])
                qr_code(qr_data);

        translate([
            0,
            height - 72,
            back_depth - overlap
        ])
            scale([1, 1, 2])
                render_text_lines(
                    text_lines,
                    width
                );

        translate([0, 0, back_depth - overlap])
            difference() {
                cube([width, height, qr_depth]);
                translate([border_width, border_width, 0])
                    cube([
                        width - border_width * 2,
                        height - border_width * 2,
                        qr_depth + 2*overlap
                    ]);
            };

        cube([width, height, back_depth]);
    }
};

module red(qr_insert) {
    color([1.0, 0.0, 0.0])
    translate([qr_margin, height - (qr_margin + 1), back_depth])
        scale([1, 1, qr_depth])
            qr_code(qr_insert);
};

module white(qr_data, qr_insert, text_lines) {
    color([1.0, 1.0, 1.0])
    difference() {
        translate([border_width, border_width, back_depth])
            cube([
                width - border_width * 2,
                height - border_width * 2,
                qr_depth - overlap
            ]);

        union() {
            black(qr_data, text_lines);

            translate([0, 0, -overlap])
                red(qr_insert);
        };
    };
};
