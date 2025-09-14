#include <stdio.h>
#include <stdint.h>
#ifdef _WIN32
  #include <winsock2.h>
  #include <ws2tcpip.h>
#else
  #include <arpa/inet.h>
#endif
#include <unistd.h>

#include "globals.h"

#ifdef ESP_PLATFORM
  #include "esp_task_wdt.h"
  #include "esp_timer.h"

  // Time between vTaskDelay calls in microseconds
  #define TASK_YIELD_INTERVAL 1000 * 1000
  // How many ticks to delay for on each yield
  #define TASK_YIELD_TICKS 1

  int64_t last_yield = 0;
  void task_yield () {
    int64_t time_now = esp_timer_get_time();
    if (time_now - last_yield < TASK_YIELD_INTERVAL) return;
    vTaskDelay(TASK_YIELD_TICKS);
    last_yield = time_now;
  }
#endif

ssize_t recv_count;
uint8_t recv_buffer[256] = {0};

int port = 25565;
int view_distance = 2;

uint32_t world_seed = INITIAL_WORLD_SEED;
uint32_t rng_seed = INITIAL_RNG_SEED;

uint8_t worldgen_mode = 0; // 0 = simple, 1 = complex

uint16_t world_time = 0;
uint32_t server_ticks = 0;

char motd[256] = "A astra server";
uint8_t motd_len = sizeof("A astra server") - 1;

#ifdef SEND_BRAND
  char brand[] = { "astra" };
  uint8_t brand_len = sizeof(brand) - 1;
#endif

uint16_t client_count;

BlockChange block_changes[MAX_BLOCK_CHANGES];
int block_changes_count = 0;

PlayerData player_data[MAX_PLAYERS];
int player_data_count = 0;

MobData mob_data[MAX_MOBS];
