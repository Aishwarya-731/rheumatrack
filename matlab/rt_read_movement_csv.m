function rec = rt_read_movement_csv(path)
%RT_READ_MOVEMENT_CSV Read a RheumaTrack movement CSV file.
%   rec = rt_read_movement_csv('file.csv') returns a struct with fields
%       joint, side, movement   (char)
%       tMs                     (n x 1 double, epoch milliseconds)
%       angleDeg                (n x 1 double)
%   Expected header: timestamp,joint,side,movement,angleDeg
%   Timestamps: yyyy-MM-ddTHH:mm:ss.SSSZ (the format the app and the generator export).
%   This reader checks structure only; full validation is done by the web application.

lines = readlines(path, 'EmptyLineRule', 'skip');
if numel(lines) < 2
    error('rt:empty', 'File %s has no data rows.', path);
end
header = strtrim(split(erase(lines(1), char(65279)), ','));
cols = {'timestamp','joint','side','movement','angleDeg'};
idx = zeros(1, numel(cols));
for k = 1:numel(cols)
    hit = find(header == cols{k}, 1);
    if isempty(hit), error('rt:header', 'Missing column %s.', cols{k}); end
    idx(k) = hit;
end
body = lines(2:end);
n = numel(body);
ts = strings(n, 1);
angles = zeros(n, 1);
joints = strings(n, 1); sides = strings(n, 1); moves = strings(n, 1);
for r = 1:n
    cells = strtrim(split(body(r), ','));
    ts(r) = cells(idx(1));
    joints(r) = cells(idx(2));
    sides(r) = cells(idx(3));
    moves(r) = cells(idx(4));
    angles(r) = str2double(cells(idx(5)));
end
if any(isnan(angles)), error('rt:angle', 'Non-numeric angle in %s.', path); end
if numel(unique(joints)) ~= 1 || numel(unique(sides)) ~= 1 || numel(unique(moves)) ~= 1
    error('rt:identity', 'All rows must describe one joint, side and movement.');
end
dt = datetime(replace(ts, 'Z', '+00:00'), 'InputFormat', 'yyyy-MM-dd''T''HH:mm:ss.SSSXXX', 'TimeZone', 'UTC');
rec.joint = char(joints(1));
rec.side = char(sides(1));
rec.movement = char(moves(1));
rec.tMs = round(posixtime(dt) * 1000);
rec.angleDeg = angles;
end
