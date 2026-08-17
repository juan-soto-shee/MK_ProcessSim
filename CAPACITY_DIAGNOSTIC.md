# MK ProcessSim — Diagnóstico causal de arranque y capacidad

Fecha: 2026-08-16

## Alcance y conclusión

Esta iteración fue exclusivamente diagnóstica. No se modificaron `breakageCalibration`, `tauPSD`, `tauHold`, ganancias PI, correlación de d50, water split ni ninguna ecuación del motor.

Los tres FAIL son reproducibles y tienen dos causas distintas:

1. El FAIL de arranque está gobernado por la aproximación lenta del flujo de sólidos al underflow `F_UF`. Entra permanentemente en su tolerancia a 537,8 min. La carga circulante contiene el mismo flujo y comparte el modo dinámico, pero entra antes porque su tolerancia numérica equivale a 1 t/h, mientras la de `F_UF` es 0,5 t/h.
2. A 150 y 200 t/h la bomba queda saturada al 100 % y 360 m³/h. El molino y las propiedades instantáneas del ciclón llegan a valores casi constantes, pero el sump continúa acumulando sólidos y agua. No existe un estado estacionario finito para esos casos con la capacidad hidráulica configurada.
3. La potencia no es la causa de esos dos fallos: solo llega a 22,0 % y 25,7 % de la potencia disponible después de eficiencia. El barrido hasta 250 t/h nunca alcanza el límite de potencia.

Estados diagnósticos asignados, sin cambiar todavía el estado interno del motor:

| Caso | Estado diagnóstico | Clasificación causal |
|---|---|---|
| Arranque base | `NO_STEADY_STATE_WITHIN_ACCEPTANCE_TIME` | modo lento de recirculación + criterio duplicado CL/FUF con tolerancias diferentes |
| 150 t/h | `CAPACITY_EXCEEDED` | A: límite modelado; B: saturación de bomba; F: ausencia de SS finito |
| 200 t/h | `CAPACITY_EXCEEDED` | A: límite modelado; B: saturación de bomba; F: ausencia de SS finito |

## 1. Diagnóstico del arranque

### Criterios utilizados

Se simuló el arranque durante 600 min contra el estado estacionario calculado por `solveSteadyState()`. T63/T90/T95/T99 corresponden al primer cruce del porcentaje del cambio total `(y(t)-y0)/(yss-y0)` y no suponen monotonicidad. La entrada en tolerancia es el primer instante desde el cual la variable permanece dentro de tolerancia hasta el final del horizonte.

Tolerancias: P80 OF 1 µm; P80 molino 2 µm; CL 1 punto porcentual; inventario molino 0,5 t; nivel 0,2 puntos porcentuales; densidad 0,01 t/m³; FUF 0,5 t/h; FOF 0,2 t/h; agua molino 0,5 t; agua sump 1 t.

### Tabla ordenada de más lenta a más rápida

| Orden | Variable | Inicial | SS | T63 min | T90 min | T95 min | T99 min | Entrada permanente min |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | F_UF, t/h | 20,9466 | 234,2025 | 89,83 | 212,83 | 273,83 | 413,50 | **537,83** |
| 2 | CL, % | 20,9466 | 234,2025 | 89,83 | 212,83 | 273,83 | 413,50 | 478,50 |
| 3 | F_OF, t/h | 0,2827 | 99,9990 | 56,00 | 136,83 | 184,33 | 322,50 | 460,00 |
| 4 | P80_mill, µm | 7572,91 | 1041,19 | 0,83 | 2,00 | 2,50 | 11,67 | 334,67 |
| 5 | densityCyclone, t/m³ | 1,0530 | 1,7368 | 52,00 | 150,83 | 208,50 | 346,00 | 313,33 |
| 6 | P80_OF, µm | 140,524 | 102,444 | 4,50 | 5,67 | 6,00 | 6,33 | 294,83 |
| 7 | sumpWaterMassT, t | 85,2543 | 49,8585 | 42,00 | 154,50 | 211,17 | 349,67 | 261,00 |
| 8 | M_mill, t | 15,3000 | 11,1401 | 0,67 | 0,83 | 1,00 | 1,00 | 246,50 |
| 9 | sumpLevelPct, % | 55,0000 | 55,0000 | 0,17 | 0,17 | 0,17 | 0,17 | 107,33 |
| 10 | millWaterMassT, t | 3,8250 | 4,7267 | 0,50 | 0,67 | 0,67 | 0,67 | 40,00 |

Los primeros cruces no equivalen a asentamiento. P80 OF y P80 molino cruzan rápidamente sus porcentajes objetivo, pero después se alejan nuevamente por overshoot y por la evolución lenta del reciclaje. Para el nivel del sump, `yss-y0` es apenas `2,27·10⁻5` puntos porcentuales; por eso sus T63–T99 de 0,17 min no tienen interpretación dinámica útil. Su entrada permanente de 107,3 min es la métrica relevante.

### Variable gobernante

La última variable es `F_UF`, a 537,83 min. Su ecuación algebraica es:

`F_UF = 60 Σᵢ Eᵢ Fpump,i`

con:

`Fpump,i = qPump · Csump · xsump,i / 60`

La composición `xsump,i` depende del balance dinámico:

`dMsump,i/dt = Fmill,out,i - Fpump,i`

y `Fmill,out,i`, a su vez, depende del inventario de molino, la rotura y el reciclaje `FUF,i`. Se forma así un modo lento de recirculación molino–sump–ciclón. No lo gobierna un único `tau` explícito, sino el lazo cerrado de inventarios por clase, partición y retorno de underflow.

Además:

`CL = 100 F_UF / Ffresh`

Para el caso base `Ffresh = 100 t/h`, CL y FUF tienen el mismo valor numérico. El criterio exige ±1 para CL y ±0,5 t/h para FUF; por ello FUF añade aproximadamente 59,3 min al tiempo conjunto. El modo físico lento es real, pero que FUF sea exactamente la última variable es parcialmente consecuencia de tolerancias inconsistentes para dos representaciones del mismo flujo.

### Término que controla cada dinámica

| Variable | Término o ecuación gobernante |
|---|---|
| P80_OF | PSD `OFᵢ=(1-Eᵢ)Fpump,i`; combina PSD lenta del sump con partición `Eᵢ(d50)` |
| P80_mill | `dMmill,i/dt=Ffresh,i+FUF,i-Mmill,i/tauHold+Bᵢ`; el cruce inicial es rápido, el asentamiento lo fuerza el reciclaje lento |
| CL | `100·FUF/Ffresh`; exactamente el mismo modo de recirculación de FUF |
| M_mill | al sumar clases, `dMmill/dt=Ffresh+FUF-Fmill`; la rotura cancela en masa total y el término lento es FUF |
| sumpLevelPct | `100(Msump/rhos+Wsump)/Vsump,max` y control PI de `qPump`; responde rápido, pero oscila mientras cambian composición e inventarios |
| densityCyclone | `(Spump+Wpump)/(Spump/rhos+Wpump)`; gobernada por inventarios de sólidos/agua del sump y `qPump` |
| F_UF | `ΣEᵢFpump,i`; gobernada por PSD/concentración del sump y la recirculación por clase |
| F_OF | `Σ(1-Eᵢ)Fpump,i`; gobernada por el mismo modo y por la acumulación total de sólidos |
| millWaterMassT | `dWmill/dt=Wfresh+Wmoisture+WUF-Wmill/tauHold`; respuesta rápida de hold-up, modulada por WUF |
| sumpWaterMassT | `dWsump/dt=Wmill,out+Wsump,fresh-Wpump`; gobernada por bomba PI y recuperación de agua UF |

Conclusión del FAIL de arranque: no es inestabilidad numérica. El sistema finalmente entra en tolerancia, pero el modo de recirculación de sólidos tarda demasiado frente al límite de 360 min. No se recomienda cambiar `tau`, ganancias o `breakageCalibration` sin contrastar esta constante aparente con datos de planta.

## 2. Caso 150 t/h

### Evolución seleccionada

| min | Power kW | M_mill t | Water mill t | P80 mill µm | P80 OF µm | CL % | F_mill t/h | F_UF t/h | F_OF t/h |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 364,32 | 11,65 | 5,24 | 3223,64 | 134,78 | 25,55 | 349,55 | 38,32 | 0,76 |
| 60 | 364,89 | 15,32 | 5,99 | 1576,92 | 108,94 | 210,18 | 459,72 | 315,27 | 84,50 |
| 240 | 444,60 | 18,67 | 5,02 | 1300,57 | 113,69 | 273,47 | 560,14 | 410,21 | 122,08 |
| 600 | 445,99 | 18,73 | 4,99 | 1295,56 | 113,64 | 274,60 | 561,89 | 411,89 | 123,43 |
| 1800 | 446,00 | 18,73 | 4,99 | 1295,53 | 113,64 | 274,60 | 561,91 | 411,91 | 123,44 |

| min | Sump % | Pump % | Qpump m³/h | d50 µm | rho cyclone t/m³ | %S cyclone | dMsolids/dt t/h | dMwater/dt t/h |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 55,54 | 71,18 | 256,25 | 100,86 | 1,096 | 13,92 | 149,24 | -0,31 |
| 60 | 58,72 | **100** | **360** | 102,75 | 1,699 | 65,35 | 65,50 | -13,40 |
| 240 | 91,50 | **100** | **360** | 104,34 | 1,931 | 76,57 | 27,92 | 7,60 |
| 600 | 158,54 | **100** | **360** | 104,38 | 1,936 | 76,80 | 26,57 | 8,02 |
| 1800 | **381,83** | **100** | **360** | 104,38 | 1,936 | 76,80 | **26,56** | **8,02** |

Diagnóstico:

- La bomba está al máximo durante 98,94 % del horizonte y `Qpump=360 m³/h`.
- El control de agua al molino nunca satura.
- El anti-windup de bomba opera: al final `dPumpIntegral=0`.
- La potencia es 446,0 kW: 20,27 % de 2200 kW instalados y 22,04 % de los 2024 kW posteriores a eficiencia. No hay falta de potencia.
- Los residuos algebraicos de sólidos y agua permanecen alrededor de `10⁻14 t/h`; RK4 no muestra deriva numérica.
- El nivel crece en los últimos 120 min a 0,1861 puntos porcentuales/min. Aunque molino, P80, CL, densidad y d50 parecen estacionarios, el inventario total crece a 26,56 t/h de sólidos y 8,02 t/h de agua.
- `F_OF=123,44 t/h < Ffresh=150 t/h`; la diferencia es exactamente la acumulación de sólidos del sistema.

Clasificación: **A + B + F**. Es un límite hidráulico modelado, con saturación del actuador bomba, que impide una solución estacionaria finita. Estado diagnóstico: **`CAPACITY_EXCEEDED`**.

## 3. Caso 200 t/h

### Evolución seleccionada

| min | Power kW | M_mill t | Water mill t | P80 mill µm | P80 OF µm | CL % | F_mill t/h | F_UF t/h | F_OF t/h |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 364,32 | 12,31 | 5,26 | 3437,49 | 134,85 | 19,42 | 369,30 | 38,84 | 0,77 |
| 60 | 447,10 | 18,78 | 5,85 | 1722,33 | 114,90 | 183,90 | 563,29 | 367,80 | 79,88 |
| 240 | 516,35 | 21,68 | 4,85 | 1478,67 | 114,93 | 225,32 | 650,54 | 450,64 | 122,07 |
| 600 | 519,62 | 21,82 | 4,80 | 1467,69 | 114,83 | 227,33 | 654,66 | 454,66 | 125,16 |
| 1800 | 519,80 | 21,83 | 4,79 | 1467,09 | 114,82 | 227,44 | 654,89 | 454,89 | 125,33 |

| min | Sump % | Pump % | Qpump m³/h | d50 µm | rho cyclone t/m³ | %S cyclone | dMsolids/dt t/h | dMwater/dt t/h |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 55,58 | 71,27 | 256,59 | 100,86 | 1,097 | 14,07 | 199,23 | 1,21 |
| 60 | 78,41 | **100** | **360** | 103,35 | 1,783 | 69,75 | 120,12 | 0,06 |
| 240 | 165,49 | **100** | **360** | 104,79 | 2,002 | 79,48 | 77,93 | 17,62 |
| 600 | 339,39 | **100** | **360** | 104,87 | 2,014 | 79,97 | 74,84 | 18,61 |
| 1800 | **918,47** | **100** | **360** | 104,87 | 2,015 | 79,99 | **74,67** | **18,67** |

Diagnóstico:

- La bomba está al máximo durante 99,28 % del horizonte; el control de agua al molino no satura.
- La potencia es 519,8 kW: 23,63 % de instalada y 25,68 % de disponible después de eficiencia. No hay falta de potencia.
- `F_OF=125,33 t/h < 200 t/h`; el sistema acumula 74,67 t/h de sólidos y 18,67 t/h de agua.
- El nivel aumenta en los últimos 120 min a 0,4826 puntos porcentuales/min. Las demás variables cambian muy poco porque el caudal de bomba está fijado por saturación, no porque el circuito completo esté estacionario.
- Los balances cierran a precisión de máquina; el crecimiento de inventario es físico dentro de las ecuaciones implementadas, no error de integración.

Clasificación: **A + B + F**. Estado diagnóstico: **`CAPACITY_EXCEEDED`**. El caso es más severo que 150 t/h y no debe recibir PASS ampliando el horizonte.

## 4. Auditoría de potencia

### `powerForInventory()`

Para velocidad crítica base, la función implementa:

`load = clamp(Mmill / 85, 0,18, 1)`

`Power = 2200 · load · 0,92`

Consecuencias:

- si `Mmill ≤ 15,3 t`, la potencia queda fija en 364,32 kW;
- si `15,3 < Mmill < 85 t`, `Power = 23,8118 · Mmill` y `Power/Mmill` es constante;
- solo si `Mmill ≥ 85 t` se alcanza el máximo de 2024 kW después de eficiencia.

### `breakageRates()`

La intensidad base es:

`intensity = breakageCalibration · Power / (Wi · Mmill · 60)`

En el intervalo `15,3 < Mmill < 85 t`, `Power` es proporcional a `Mmill`, por lo que ambos se cancelan y la intensidad de rotura deja de depender del inventario. El mecanismo de degradación por potencia limitada existe algebraicamente solo después de `Mmill ≥ 85 t`, cuando Power queda constante y `Power/Mmill` empieza a caer. Ningún caso hasta 250 t/h alcanza ese inventario.

### Barrido de alimentación

Las filas marcadas “No” no son estados estacionarios: son el último estado finito a 1800 min.

| Feed t/h | Convergió | Power kW | Power/Installed % | Power/Disponible % | kWh/t fresca | P80 mill µm | P80 OF µm | CL % |
|---:|:---:|---:|---:|---:|---:|---:|---:|---:|
| 50 | Sí | 364,32 | 16,56 | 18,00 | 7,286 | 359,19 | 54,43 | 71,83 |
| 75 | Sí | 364,32 | 16,56 | 18,00 | 4,858 | 699,04 | 80,70 | 128,11 |
| 100 | Sí | 364,32 | 16,56 | 18,00 | 3,643 | 1041,19 | 102,44 | 234,20 |
| 125 | **No** | 404,76 | 18,40 | 20,00 | 3,238 | 1192,18 | 112,87 | 307,96 |
| 150 | **No** | 446,00 | 20,27 | 22,04 | 2,973 | 1295,53 | 113,64 | 274,60 |
| 175 | **No** | 484,10 | 22,00 | 23,92 | 2,766 | 1386,26 | 114,27 | 248,52 |
| 200 | **No** | 519,80 | 23,63 | 25,68 | 2,599 | 1467,09 | 114,82 | 227,44 |
| 225 | **No** | 553,60 | 25,16 | 27,35 | 2,460 | 1539,94 | 115,30 | 209,99 |
| 250 | **No** | 585,88 | 26,63 | 28,95 | 2,344 | 1606,21 | 115,72 | 195,25 |

Puntos identificados:

- Potencia al límite: **no aparece hasta 250 t/h**. El máximo observado es 585,88 kW, 28,95 % de la potencia disponible después de eficiencia.
- Energía específica empieza a caer: desde el primer incremento, 50 → 75 t/h, porque la potencia permanece en el mínimo de 364,32 kW mientras aumenta el feed.
- P80 empieza a deteriorarse: también entre 50 y 75 t/h, tanto en descarga de molino como en overflow.
- Primera ausencia de convergencia del barrido: 125 t/h. Ya presenta acumulación de 3,65 t/h de sólidos y 1,24 t/h de agua al final del horizonte.

La cadena esperada aparece solo parcialmente:

`Feed ↑ → energía específica sobre feed fresco ↓ → P80 ↑`

No aparece:

`demanda energética ↑ → potencia alcanza installedPower`

La potencia crece con inventario, pero el límite hidráulico de la bomba se alcanza mucho antes que el inventario de 85 t requerido para saturar potencia. El material adicional se acumula principalmente en el sump, no en el molino. Por tanto, el modelo actual no permite identificar una capacidad de molino limitada por potencia en este rango.

**ERROR DE MODELO para análisis de capacidad energética:** aunque `powerForInventory()` contiene formalmente un cap, el acoplamiento actual no reproduce la secuencia operacional de un molino que alcanza potencia instalada al aumentar throughput. El deterioro de P80 sí aparece, pero no puede atribuirse a saturación de potencia. La capacidad observada es hidráulica y provisional.

## 5. Clasificación causal completa

| Clase | 150 t/h | 200 t/h | Evidencia |
|---|:---:|:---:|---|
| A) límite físico/modelado | Sí | Sí | `Qpump` limitado a 360 m³/h |
| B) saturación de actuador | Sí | Sí | bomba al 100 % durante >98,9 % del horizonte |
| C) controlador | No como causa primaria | No como causa primaria | PI ordena máximo y anti-windup detiene integral; no puede superar capacidad |
| D) falta de potencia | No | No | 22,04 % y 25,68 % de potencia disponible |
| E) inestabilidad numérica | No | No | balances ~10⁻14; variables locales suaves; acumulación lineal coherente |
| F) ausencia de solución estacionaria | Sí | Sí | derivadas de inventario positivas persistentes y nivel sin cota |
| G) otra | Sí, secundaria | Sí, secundaria | `solveSteadyState()` no detiene por sump >100 %, aunque la UI sí tiene trip |

## 6. Cambios recomendados para una iteración posterior

### Cambios físicos o estructurales

1. Añadir una prueba de factibilidad estacionaria: si bomba está saturada, nivel crece y las tasas de inventario permanecen positivas, devolver `CAPACITY_EXCEEDED` sin seguir presentando variables locales como posible SS.
2. Unificar la física de capacidad del sump entre UI y solver. Elegir explícitamente trip, rebalse con balance de masa o inviabilidad; no permitir nivel de 382–918 % como trayectoria operable.
3. Separar potencia instalada, potencia al eje y potencia neta de molienda. La capacidad energética debe depender de una relación de carga/potencia validable y del throughput interno, no únicamente de `Mmill/initialMillSolidsT`.
4. Evaluar energía específica sobre la corriente adecuada para el propósito: feed fresco para KPI de planta y flujo molino/interno para cinética, documentando la diferencia.
5. No usar resultados no convergidos de 125–250 t/h como estados estacionarios en tablas de capacidad.

### Cambios calibrables, solo después de datos

1. Capacidad/curva de bomba–sistema y `pumpMaxFlowM3h`.
2. Relación potencia–inventario–velocidad y `minimumPowerFraction`.
3. Cinética `breakageCalibration` y dependencia granulométrica, después de corregir el mecanismo energético estructural.
4. Partición y water split de ciclón con survey de planta.
5. Ganancias PI y tiempos integrales, usando respuestas medidas; no para convertir estos FAIL en PASS.

### Criterios de aceptación

1. Expresar CL y FUF con tolerancias físicamente equivalentes para evitar duplicar la misma variable con exigencias diferentes. Esto no elimina el modo lento, solo hace coherente el criterio.
2. Separar “variables locales casi constantes” de “estado estacionario global”: exigir simultáneamente inventarios estacionarios, nivel dentro de capacidad y actuadores factibles.
3. Mantener los FAIL actuales hasta que una modificación física/calibrada cambie causalmente el comportamiento.

## Reproducibilidad

Los cálculos se reproducen con:

`node diagnostics/capacity_diagnostic.js`

El script solo consume la API pública de `engine.js`; no modifica el motor ni sus parámetros.
