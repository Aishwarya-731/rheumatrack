function rt_export_recording(tMs, angleDeg, joint, side, movement, outBase, source)
%RT_EXPORT_RECORDING Write any joint-angle recording in the RheumaTrack CSV + JSON format.
%
%   rt_export_recording(tMs, angleDeg, joint, side, movement, outBase)
%   rt_export_recording(..., source)   % 'simulation' (default) or 'imported'
%
%   Use this to convert your OWN data (e.g. a goniometer or IMU export already converted to a
%   joint angle in degrees) into a file RheumaTrack can import.
%     tMs       epoch milliseconds (UTC), strictly increasing  — e.g. posixtime(dt)*1000
%     angleDeg  joint angle in degrees, same length as tMs
%     joint     'shoulder'|'elbow'|'wrist'|'hip'|'knee'|'ankle'
%     side      'left'|'right'
%     movement  supported for the joint (see rt_config.m)
%     outBase   output path without extension
%
%   Example:
%     t0 = datetime('2026-10-26 09:00:00','TimeZone','Asia/Kolkata');
%     tMs = round(posixtime(t0)*1000) + (0:999)'*20;          % 50 Hz
%     angle = 45 - 45*cos(2*pi*(0:999)'/200);                  % your angles here
%     rt_export_recording(tMs, angle, 'knee', 'left', 'flexion', 'my_knee_session', 'imported');

if nargin < 7 || isempty(source), source = 'simulation'; end
cfg = rt_config();
tMs = round(tMs(:));
angleDeg = angleDeg(:);
if numel(tMs) ~= numel(angleDeg), error('rt:size', 'tMs and angleDeg must have the same length.'); end
if numel(tMs) < cfg.minSamples, error('rt:size', 'At least %d samples are required.', cfg.minSamples); end
if any(diff(tMs) <= 0), error('rt:order', 'Timestamps must be strictly increasing (no duplicates).'); end
if any(~isfinite(angleDeg)), error('rt:angle', 'Angles must be finite numbers.'); end
if any(angleDeg < cfg.minAngleDeg | angleDeg > cfg.maxAngleDeg), error('rt:angle', 'Angles must be within -180..180 degrees.'); end
if ~isfield(cfg.movements, joint) || ~any(strcmp(movement, cfg.movements.(joint)))
    error('rt:movement', 'Movement "%s" is not supported for joint "%s".', movement, joint);
end
if ~any(strcmp(side, {'left','right'})), error('rt:side', 'Side must be left or right.'); end

dt = datetime(tMs / 1000, 'ConvertFrom', 'posixtime', 'TimeZone', 'UTC');
dt.Format = 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z''';
stamps = cellstr(string(dt));

fid = fopen([outBase '.csv'], 'w');
fprintf(fid, 'timestamp,joint,side,movement,angleDeg\n');
for k = 1:numel(tMs)
    fprintf(fid, '%s,%s,%s,%s,%s\n', stamps{k}, joint, side, movement, num2str(angleDeg(k), '%.15g'));
end
fclose(fid);

doc = struct('format', cfg.formatId, 'joint', joint, 'side', side, 'movement', movement, ...
    'unit', 'deg', 'source', source);
doc.samples = struct('timestamp', stamps, 'angleDeg', num2cell(angleDeg));
fid = fopen([outBase '.json'], 'w');
fprintf(fid, '%s', jsonencode(doc, 'PrettyPrint', true));
fclose(fid);
fprintf('Wrote %s.csv and %s.json (%d samples)\n', outBase, outBase, numel(tMs));
end
