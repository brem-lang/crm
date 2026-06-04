<?php
$configFile = __DIR__ . '/data/crm-config.json';
$config = @json_decode(@file_get_contents($configFile), true);
$crmName = htmlspecialchars($config['crmName'] ?? 'CRM', ENT_QUOTES, 'UTF-8');
$description = $crmName . ' - Lead Management System';

$html = file_get_contents(__DIR__ . '/dist/index.html');

$html = str_replace(
    'content="Alpha Leadz - Lead Management System"',
    'content="' . $description . '"',
    $html
);
$html = str_replace(
    'content="Alpha Leadz"',
    'content="' . $crmName . '"',
    $html
);
$html = preg_replace(
    '/<title>[^<]*<\/title>/',
    '<title>' . $crmName . '</title>',
    $html
);

header('Content-Type: text/html; charset=UTF-8');
echo $html;
