# doom.nats:spawn/batch_step —— 批量循环体
scoreboard players add $batch doom.nats 1
function doom.nats:spawn/try
execute if score $batch doom.nats < $eff.batch doom.nats run function doom.nats:spawn/batch_step
